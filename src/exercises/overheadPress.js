import { angleDeg, RollingMedian, visible } from "../lib/geometry";
import { LM } from "../lib/pose";
// ── Thresholds ─────────────────────────────────────────────────────────────────
const ELBOW_START = 130; // below → pressing
const ELBOW_TOP = 165; // above → lockout (rep complete)
const ELBOW_RETURN = 140; // below (after top) → descending again
const MAX_BACK_ARCH = 20; // torso lean from vertical at press (side view)
const ELBOW_SYM_DEG = 20; // |L - R| elbow angle (front view)
const ELBOW_FLARE = 1.4; // elbow span / shoulder span ratio (front view)
const LOCKOUT_ANG = 178; // avg elbow above this → warn
const REP_TARGET = 10;
const HYSTERESIS = 5;
// ── Module-level smoothers ─────────────────────────────────────────────────────
const lElbowSmoother = new RollingMedian(5);
const rElbowSmoother = new RollingMedian(5);
const backSmoother = new RollingMedian(5);
export const overheadPress = {
    id: "overheadPress",
    label: "Overhead Press",
    icon: "🙌",
    category: "Upper Body",
    supportedViews: ["front", "side-left", "side-right"],
    setupTip: "Stand facing or sideways to camera. Bar starts at shoulder height — full body in frame.",
    initialState() {
        lElbowSmoother.reset();
        rElbowSmoother.reset();
        backSmoother.reset();
        return {
            phase: "READY",
            reps: 0,
            repLog: [],
            scratch: { minElbow: 180, maxBackLean: 0, repStartAt: 0 },
        };
    },
    evaluate(landmarks, prev, nowMs, viewAngle) {
        const state = { ...prev, repLog: prev.repLog, scratch: { ...prev.scratch } };
        const feedback = [];
        let repCompleted = false;
        if (!landmarks || landmarks.length === 0) {
            feedback.push({ id: "no-pose", severity: "warn", message: "Step into frame", at: nowMs });
            return { state, feedback, repCompleted };
        }
        const lSh = landmarks[LM.LEFT_SHOULDER];
        const rSh = landmarks[LM.RIGHT_SHOULDER];
        const lEl = landmarks[LM.LEFT_ELBOW];
        const rEl = landmarks[LM.RIGHT_ELBOW];
        const lWr = landmarks[LM.LEFT_WRIST];
        const rWr = landmarks[LM.RIGHT_WRIST];
        const lHip = landmarks[LM.LEFT_HIP];
        const rHip = landmarks[LM.RIGHT_HIP];
        if (!visible([lSh, rSh, lEl, rEl], 0.35)) {
            feedback.push({ id: "no-pose", severity: "warn", message: "Keep upper body in frame", at: nowMs });
            return { state, feedback, repCompleted };
        }
        const lElbowAng = lElbowSmoother.push(angleDeg(lSh, lEl, lWr));
        const rElbowAng = rElbowSmoother.push(angleDeg(rSh, rEl, rWr));
        const avgElbow = (lElbowAng + rElbowAng) / 2;
        const shMid = { x: (lSh.x + rSh.x) / 2, y: (lSh.y + rSh.y) / 2 };
        const hpMid = { x: (lHip.x + rHip.x) / 2, y: (lHip.y + rHip.y) / 2 };
        const vertUp = { x: hpMid.x, y: hpMid.y - 0.2 };
        const backLean = backSmoother.push(angleDeg(shMid, hpMid, vertUp));
        if (state.phase === "READY" && avgElbow < ELBOW_START - HYSTERESIS) {
            state.phase = "ASCENDING";
            state.scratch.repStartAt = nowMs;
            state.scratch.minElbow = avgElbow;
            state.scratch.maxBackLean = backLean;
        }
        else if (state.phase === "ASCENDING") {
            if (avgElbow < state.scratch.minElbow)
                state.scratch.minElbow = avgElbow;
            if (backLean > state.scratch.maxBackLean)
                state.scratch.maxBackLean = backLean;
            if (avgElbow >= ELBOW_TOP + HYSTERESIS)
                state.phase = "TOP";
        }
        else if (state.phase === "TOP") {
            if (avgElbow < ELBOW_RETURN - HYSTERESIS) {
                state.phase = "DESCENDING";
            }
        }
        else if (state.phase === "DESCENDING") {
            if (avgElbow < ELBOW_START - HYSTERESIS) {
                state.reps += 1;
                repCompleted = true;
                state.repLog = [
                    ...state.repLog,
                    {
                        repIndex: state.reps,
                        tempoSec: Number(((nowMs - state.scratch.repStartAt) / 1000).toFixed(2)),
                        metrics: {
                            minElbowAngle: Number(state.scratch.minElbow.toFixed(1)),
                            maxBackLean: Number(state.scratch.maxBackLean.toFixed(1)),
                        },
                    },
                ];
                if (state.reps >= REP_TARGET) {
                    feedback.push({ id: "set-complete", severity: "good", message: `Set complete — ${REP_TARGET} reps!`, at: nowMs });
                }
                else {
                    feedback.push({ id: "rep-good", severity: "good", message: `Rep ${state.reps} — pressed!`, at: nowMs });
                }
                state.phase = "ASCENDING";
                state.scratch.minElbow = avgElbow;
                state.scratch.maxBackLean = backLean;
                state.scratch.repStartAt = nowMs;
            }
        }
        const inRep = state.phase !== "READY";
        const isSide = viewAngle === "side-left" || viewAngle === "side-right";
        if (inRep && isSide && backLean > MAX_BACK_ARCH) {
            feedback.push({ id: "back-arch", severity: "warn", message: "Don't arch your lower back — brace your core", at: nowMs });
        }
        if (inRep && !isSide && Math.abs(lElbowAng - rElbowAng) > ELBOW_SYM_DEG) {
            feedback.push({ id: "elbow-sym", severity: "warn", message: "Keep both sides even", at: nowMs });
        }
        if (inRep && !isSide) {
            const elbowSpan = Math.abs(lEl.x - rEl.x);
            const shoulderSpan = Math.abs(lSh.x - rSh.x);
            if (shoulderSpan > 0.01 && elbowSpan / shoulderSpan > ELBOW_FLARE) {
                feedback.push({ id: "elbow-flare", severity: "warn", message: "Keep elbows narrower — reduce flare", at: nowMs });
            }
        }
        if (state.phase === "TOP" && avgElbow > LOCKOUT_ANG) {
            feedback.push({ id: "lockout", severity: "warn", message: "Don't fully lock elbows — maintain slight bend", at: nowMs });
        }
        return { state, feedback, repCompleted };
    },
};
