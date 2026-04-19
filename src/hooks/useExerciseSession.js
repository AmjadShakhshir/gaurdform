import { useEffect, useRef, useState, useCallback } from "react";
import { createPoseEngine } from "../lib/pose";
import { speak, haptic, cancelSpeech } from "../lib/feedback";
import { detectViewAngle, resetViewAngle } from "../lib/viewAngle";
export function useExerciseSession(exercise, videoRef) {
    const [status, setStatus] = useState("idle");
    const [statusMsg, setStatusMsg] = useState("");
    const [state, setState] = useState(() => exercise.initialState());
    const [activeFeedback, setActiveFeedback] = useState([]);
    const [landmarks, setLandmarks] = useState(null);
    const [viewAngle, setViewAngle] = useState("unknown");
    const [setComplete, setSetComplete] = useState(false);
    const [fps, setFps] = useState(0);
    const landmarkerRef = useRef(null);
    const rafRef = useRef(null);
    const lastVideoTimeRef = useRef(-1);
    const stateRef = useRef(state);
    const didSetCompleteRef = useRef(false);
    // FPS tracking
    const lastLoopTimeRef = useRef(0);
    const fpsEmaRef = useRef(0);
    const frameCountRef = useRef(0);
    // Stable reference to stop — updated each render so the RAF loop can call it.
    const stopRef = useRef(() => { });
    // Safety: consecutive error escalation and pose visibility debounce
    const consecutiveErrorCountsRef = useRef(new Map());
    const lastValidPoseAtRef = useRef(0);
    // Reset when exercise changes
    useEffect(() => {
        cancelSpeech();
        resetViewAngle();
        const fresh = exercise.initialState();
        stateRef.current = fresh;
        setState(fresh);
        setActiveFeedback([]);
        setSetComplete(false);
        setViewAngle("unknown");
        didSetCompleteRef.current = false;
    }, [exercise]);
    const start = useCallback(async () => {
        setStatus("loading");
        setStatusMsg("Starting camera…");
        setSetComplete(false);
        setViewAngle("unknown");
        resetViewAngle();
        didSetCompleteRef.current = false;
        lastLoopTimeRef.current = 0;
        fpsEmaRef.current = 0;
        frameCountRef.current = 0;
        consecutiveErrorCountsRef.current.clear();
        lastValidPoseAtRef.current = 0;
        try {
            // 1. Camera
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: "user",
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                },
                audio: false,
            });
            const video = videoRef.current;
            if (!video)
                throw new Error("Video element missing");
            video.srcObject = stream;
            await video.play();
            // 2. Pose engine
            setStatusMsg("Loading pose model…");
            const engine = await createPoseEngine({ useGPU: true, modelVariant: "full" });
            landmarkerRef.current = engine.landmarker;
            setStatus("ready");
            setStatusMsg("");
            // 3. Detection loop
            const loop = () => {
                const v = videoRef.current;
                const lm = landmarkerRef.current;
                if (!v || !lm)
                    return;
                if (v.currentTime !== lastVideoTimeRef.current && v.readyState >= 2) {
                    lastVideoTimeRef.current = v.currentTime;
                    const now = performance.now();
                    // FPS EMA (updated every 30 frames to avoid excessive renders).
                    if (lastLoopTimeRef.current > 0) {
                        fpsEmaRef.current =
                            0.9 * fpsEmaRef.current + 0.1 * (1000 / (now - lastLoopTimeRef.current));
                    }
                    lastLoopTimeRef.current = now;
                    frameCountRef.current += 1;
                    if (frameCountRef.current % 30 === 0) {
                        setFps(Math.round(fpsEmaRef.current));
                    }
                    const result = lm.detectForVideo(v, now);
                    const poseLandmarks = result.landmarks?.[0] ?? null;
                    setLandmarks(poseLandmarks);
                    if (poseLandmarks) {
                        lastValidPoseAtRef.current = now;
                        const angle = detectViewAngle(poseLandmarks);
                        setViewAngle(angle);
                        const viewOk = angle === "unknown" || exercise.supportedViews.includes(angle);
                        if (!viewOk) {
                            setActiveFeedback([{
                                    id: "reposition",
                                    severity: "warn",
                                    message: "Reposition camera for this exercise",
                                    at: now,
                                }]);
                        }
                        else {
                            const evalResult = exercise.evaluate(poseLandmarks, stateRef.current, now, angle);
                            const prevS = stateRef.current;
                            const newS = evalResult.state;
                            stateRef.current = newS;
                            if (prevS.phase !== newS.phase ||
                                prevS.reps !== newS.reps ||
                                prevS.repLog.length !== newS.repLog.length) {
                                setState(newS);
                            }
                            // Consecutive error escalation: same error 3+ frames → critical
                            const activeErrorIds = new Set(evalResult.feedback.filter((f) => f.severity === "error").map((f) => f.id));
                            for (const [id] of consecutiveErrorCountsRef.current) {
                                if (!activeErrorIds.has(id))
                                    consecutiveErrorCountsRef.current.delete(id);
                            }
                            const escalatedFeedback = evalResult.feedback.map((f) => {
                                if (f.severity !== "error")
                                    return f;
                                const count = (consecutiveErrorCountsRef.current.get(f.id) ?? 0) + 1;
                                consecutiveErrorCountsRef.current.set(f.id, count);
                                if (count >= 3) {
                                    return { ...f, severity: "critical", message: `STOP — ${f.message}` };
                                }
                                return f;
                            });
                            if (escalatedFeedback.length > 0 || evalResult.repCompleted) {
                                setActiveFeedback((prev) => {
                                    const combined = [...prev];
                                    for (const f of escalatedFeedback) {
                                        const idx = combined.findIndex((x) => x.id === f.id);
                                        if (idx >= 0)
                                            combined[idx] = f;
                                        else
                                            combined.push(f);
                                    }
                                    return combined.filter((x) => now - x.at < 2500);
                                });
                                for (const f of escalatedFeedback) {
                                    if (f.id !== "calibrating") {
                                        if (f.severity === "critical") {
                                            speak("STOP and reset form");
                                            haptic("critical");
                                        }
                                        else if (f.severity === "error" || f.severity === "warn") {
                                            speak(f.message);
                                            haptic(f.severity);
                                        }
                                        else if (f.severity === "good") {
                                            haptic("good");
                                        }
                                    }
                                    if (f.id === "set-complete" && !didSetCompleteRef.current) {
                                        didSetCompleteRef.current = true;
                                        setSetComplete(true);
                                    }
                                }
                            }
                        }
                    }
                    else if (lastValidPoseAtRef.current > 0 && now - lastValidPoseAtRef.current > 500) {
                        // Visibility debounce: only nag user after 500 ms of no pose
                        setActiveFeedback([{
                                id: "no-pose",
                                severity: "warn",
                                message: "Step fully into frame",
                                at: now,
                            }]);
                    }
                }
                rafRef.current = requestAnimationFrame(loop);
            };
            rafRef.current = requestAnimationFrame(loop);
        }
        catch (err) {
            console.error(err);
            setStatus("error");
            setStatusMsg(err instanceof Error ? err.message : "Failed to start");
        }
    }, [exercise, videoRef]);
    const stop = useCallback(() => {
        if (rafRef.current)
            cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
        didSetCompleteRef.current = false;
        if (landmarkerRef.current) {
            landmarkerRef.current.close();
            landmarkerRef.current = null;
        }
        const v = videoRef.current;
        const stream = v?.srcObject;
        stream?.getTracks().forEach((t) => t.stop());
        if (v)
            v.srcObject = null;
        cancelSpeech();
        setStatus("idle");
    }, [videoRef]);
    // Keep stopRef in sync with the latest memoized stop function.
    stopRef.current = stop;
    useEffect(() => () => stop(), [stop]);
    return { status, statusMsg, state, activeFeedback, landmarks, viewAngle, setComplete, fps, start, stop };
}
