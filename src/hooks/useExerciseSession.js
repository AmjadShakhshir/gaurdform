import { useEffect, useRef, useState, useCallback } from "react";
import { createPoseEngine } from "../lib/pose";
import { speak, haptic, cancelSpeech } from "../lib/feedback";
import { detectViewAngle, resetViewAngle } from "../lib/viewAngle";
const NO_POSE_WARNING_DELAY_MS = 500;
function cleanupSessionResources(videoRef, landmarkerRef, rafRef) {
    if (rafRef.current)
        cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (landmarkerRef.current) {
        landmarkerRef.current.close();
        landmarkerRef.current = null;
    }
    const video = videoRef.current;
    const stream = video?.srcObject;
    stream?.getTracks().forEach((track) => track.stop());
    if (video) {
        video.pause();
        video.srcObject = null;
    }
}
function getStartupErrorMessage(error) {
    if (error instanceof DOMException) {
        if (error.name === "NotAllowedError" || error.name === "SecurityError") {
            return "Camera permission was blocked. Allow camera access in the browser and tap Retry.";
        }
        if (error.name === "NotFoundError" || error.name === "OverconstrainedError") {
            return "No working camera was found on this device.";
        }
        if (error.name === "NotReadableError" || error.name === "AbortError") {
            return "The camera is busy or could not start. Close other camera apps and tap Retry.";
        }
    }
    if (error instanceof Error) {
        if (/fetch|network|load/i.test(error.message)) {
            return "The pose model could not load. Check your connection and tap Retry.";
        }
        return error.message;
    }
    return "Camera startup failed. Tap Retry to try again.";
}
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
    const setSessionError = useCallback((message) => {
        cleanupSessionResources(videoRef, landmarkerRef, rafRef);
        didSetCompleteRef.current = false;
        cancelSpeech();
        setStatus("error");
        setStatusMsg(message);
        setLandmarks(null);
        setFps(0);
    }, [videoRef]);
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
        setLandmarks(null);
        setActiveFeedback([]);
        setFps(0);
        if (!navigator.mediaDevices?.getUserMedia) {
            setSessionError("This browser does not support live camera access.");
            return;
        }
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
                    try {
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
                                const activeErrorIds = new Set(evalResult.feedback.filter((feedback) => feedback.severity === "error").map((feedback) => feedback.id));
                                for (const [id] of consecutiveErrorCountsRef.current) {
                                    if (!activeErrorIds.has(id))
                                        consecutiveErrorCountsRef.current.delete(id);
                                }
                                const escalatedFeedback = evalResult.feedback.map((feedback) => {
                                    if (feedback.severity !== "error")
                                        return feedback;
                                    const count = (consecutiveErrorCountsRef.current.get(feedback.id) ?? 0) + 1;
                                    consecutiveErrorCountsRef.current.set(feedback.id, count);
                                    if (count >= 3) {
                                        return { ...feedback, severity: "critical", message: `STOP — ${feedback.message}` };
                                    }
                                    return feedback;
                                });
                                if (escalatedFeedback.length > 0 || evalResult.repCompleted) {
                                    setActiveFeedback((prev) => {
                                        const combined = [...prev];
                                        for (const feedback of escalatedFeedback) {
                                            const idx = combined.findIndex((item) => item.id === feedback.id);
                                            if (idx >= 0)
                                                combined[idx] = feedback;
                                            else
                                                combined.push(feedback);
                                        }
                                        return combined.filter((item) => now - item.at < 2500);
                                    });
                                    for (const feedback of escalatedFeedback) {
                                        if (feedback.id !== "calibrating") {
                                            if (feedback.severity === "critical") {
                                                speak("STOP and reset form");
                                                haptic("critical");
                                            }
                                            else if (feedback.severity === "error" || feedback.severity === "warn") {
                                                speak(feedback.message);
                                                haptic(feedback.severity);
                                            }
                                            else if (feedback.severity === "good") {
                                                haptic("good");
                                            }
                                        }
                                        if (feedback.id === "set-complete" && !didSetCompleteRef.current) {
                                            didSetCompleteRef.current = true;
                                            setSetComplete(true);
                                        }
                                    }
                                }
                            }
                        }
                        else if (lastValidPoseAtRef.current > 0 && now - lastValidPoseAtRef.current > NO_POSE_WARNING_DELAY_MS) {
                            setActiveFeedback([{
                                    id: "no-pose",
                                    severity: "warn",
                                    message: "Step fully into frame",
                                    at: now,
                                }]);
                        }
                    }
                    catch (error) {
                        console.error(error);
                        setSessionError("Pose tracking stopped unexpectedly. Tap Retry to start the camera again.");
                        return;
                    }
                }
                rafRef.current = requestAnimationFrame(loop);
            };
            rafRef.current = requestAnimationFrame(loop);
        }
        catch (err) {
            console.error(err);
            setSessionError(getStartupErrorMessage(err));
        }
    }, [exercise, setSessionError, videoRef]);
    const stop = useCallback(() => {
        cleanupSessionResources(videoRef, landmarkerRef, rafRef);
        didSetCompleteRef.current = false;
        cancelSpeech();
        setStatus("idle");
        setStatusMsg("");
        setLandmarks(null);
        setFps(0);
    }, [videoRef]);
    // Keep stopRef in sync with the latest memoized stop function.
    stopRef.current = stop;
    useEffect(() => () => stop(), [stop]);
    return { status, statusMsg, state, activeFeedback, landmarks, viewAngle, setComplete, fps, start, stop };
}
