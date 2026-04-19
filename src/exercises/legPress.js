import { angleDeg, RollingMedian, visible } from "../lib/geometry";
import { LM } from "../lib/pose";
// ── Thresholds ─────────────────────────────────────────────────────────────────
const DESC_KNEE = 150; // below → descending
const BOTTOM_KNEE = 90; // below → at bottom
const ASCEND_KNEE = 110; // above (from bottom) → ascending
const TOP_KNEE = 160; // above → rep complete
const LOCKOUT_WARN = 175; // over-extension warning
const LOCKOUT_ERROR = 178; // dangerous joint lockout
const REP_TARGET = 10;
const HYSTERESIS = 5;
// ── Module-level smoother ──────────────────────────────────────────────────────
const kneeSmoother = new RollingMedian(5);
export const legPress = {
    id: "legPress",
    label: "Leg Press",
    icon: "🦿",
    category: "Legs",
    supportedViews: ["side-left", "side-right"],
    setupTip: "Camera should capture your full side profile — head, hips, knees and feet all visible.",
    initialState() {
        kneeSmoother.reset();
        return {
            phase: "READY",
            reps: 0,
            repLog: [],
            scratch: { minKnee: 180, repStartAt: 0 },
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
        const useLeft = viewAngle === "side-left" || (landmarks[LM.LEFT_KNEE].visibility ?? 0) >= (landmarks[LM.RIGHT_KNEE].visibility ?? 0);
        const hip = useLeft ? landmarks[LM.LEFT_HIP] : landmarks[LM.RIGHT_HIP];
        const knee = useLeft ? landmarks[LM.LEFT_KNEE] : landmarks[LM.RIGHT_KNEE];
        const ankle = useLeft ? landmarks[LM.LEFT_ANKLE] : landmarks[LM.RIGHT_ANKLE];
        if (!visible([hip, knee, ankle], 0.40)) {
            feedback.push({ id: "no-pose", severity: "warn", message: "Stand sideways — keep legs visible", at: nowMs });
            return { state, feedback, repCompleted };
        }
        const kneeAng = kneeSmoother.push(angleDeg(hip, knee, ankle));
        if (state.phase === "READY" && kneeAng < DESC_KNEE - HYSTERESIS) {
            state.phase = "DESCENDING";
            state.scratch.repStartAt = nowMs;
            state.scratch.minKnee = kneeAng;
        }
        else if (state.phase === "DESCENDING") {
            if (kneeAng < state.scratch.minKnee)
                state.scratch.minKnee = kneeAng;
            if (kneeAng < BOTTOM_KNEE - HYSTERESIS)
                state.phase = "BOTTOM";
        }
        else if (state.phase === "BOTTOM") {
            if (kneeAng < state.scratch.minKnee)
                state.scratch.minKnee = kneeAng;
            if (kneeAng > ASCEND_KNEE + HYSTERESIS)
                state.phase = "ASCENDING";
        }
        else if (state.phase === "ASCENDING") {
            if (kneeAng > TOP_KNEE + HYSTERESIS) {
                state.reps += 1;
                repCompleted = true;
                state.repLog = [
                    ...state.repLog,
                    {
                        repIndex: state.reps,
                        tempoSec: Number(((nowMs - state.scratch.repStartAt) / 1000).toFixed(2)),
                        metrics: { minKneeAngle: Number(state.scratch.minKnee.toFixed(1)) },
                    },
                ];
                if (state.reps >= REP_TARGET) {
                    feedback.push({ id: "set-complete", severity: "good", message: `Set complete — ${REP_TARGET} reps!`, at: nowMs });
                }
                else if (state.scratch.minKnee > 100) {
                    feedback.push({ id: "depth", severity: "warn", message: "Push for 90° knee bend at bottom", at: nowMs });
                }
                else {
                    feedback.push({ id: "rep-good", severity: "good", message: `Rep ${state.reps} — ${Math.round(state.scratch.minKnee)}°`, at: nowMs });
                }
                state.phase = "READY";
                state.scratch.minKnee = 180;
            }
        }
        if (state.phase === "ASCENDING" && kneeAng > LOCKOUT_ERROR) {
            feedback.push({ id: "lockout", severity: "error", message: "Danger: joint lockout — lower the weight immediately", at: nowMs });
        }
        else if (state.phase === "ASCENDING" && kneeAng > LOCKOUT_WARN) {
            feedback.push({ id: "lockout", severity: "warn", message: "Don't lock out at the top — keep tension", at: nowMs });
        }
        return { state, feedback, repCompleted };
    },
};
