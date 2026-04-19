import { RollingMedian, visible } from "../lib/geometry";
import { LM } from "../lib/pose";
// ── Thresholds ─────────────────────────────────────────────────────────────────
const CALIBRATION_MS = 2000;
const RISE_THRESH = 0.018; // normalised Y heel rise to count as ascending
const PEAK_THRESH = 0.035; // at peak
const RETURN_THRESH = 0.010; // back to near baseline = descent complete
const HYSTERESIS = 0.003; // dead-band to prevent oscillation
const REP_TARGET = 15;
// ── Module-level smoother ──────────────────────────────────────────────────────
const heelSmoother = new RollingMedian(5);
export const calfRaise = {
    id: "calfRaise",
    label: "Calf Raise",
    icon: "👟",
    category: "Legs",
    targetCount: REP_TARGET,
    supportedViews: ["side-left", "side-right"],
    setupTip: "Stand sideways to the camera. Hold still for 2 s to calibrate heel baseline.",
    initialState() {
        heelSmoother.reset();
        return {
            phase: "CALIBRATING",
            reps: 0,
            repLog: [],
            scratch: {
                calibStartAt: -1,
                calibFrames: 0,
                calibHeelYSum: 0,
                baselineHeelY: -1,
                maxRise: 0,
                repStartAt: 0,
            },
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
        const useLeft = viewAngle === "side-left" || (landmarks[LM.LEFT_ANKLE].visibility ?? 0) >= (landmarks[LM.RIGHT_ANKLE].visibility ?? 0);
        const heel = useLeft ? landmarks[LM.LEFT_HEEL] : landmarks[LM.RIGHT_HEEL];
        const ankle = useLeft ? landmarks[LM.LEFT_ANKLE] : landmarks[LM.RIGHT_ANKLE];
        if (!visible([ankle], 0.40)) {
            feedback.push({ id: "no-pose", severity: "warn", message: "Keep ankles visible", at: nowMs });
            return { state, feedback, repCompleted };
        }
        // Use heel if available, fall back to ankle
        const heelY = (heel && (heel.visibility ?? 0) > 0.3) ? heel.y : ankle.y;
        const smoothHeelY = heelSmoother.push(heelY);
        // ── CALIBRATING ─────────────────────────────────────────────────────────────
        if (state.phase === "CALIBRATING") {
            if (state.scratch.calibStartAt < 0)
                state.scratch.calibStartAt = nowMs;
            const elapsed = nowMs - state.scratch.calibStartAt;
            state.scratch.calibHeelYSum += smoothHeelY;
            state.scratch.calibFrames += 1;
            if (elapsed < CALIBRATION_MS) {
                const rem = Math.ceil((CALIBRATION_MS - elapsed) / 1000);
                feedback.push({ id: "calibrating", severity: "warn", message: `Hold still — calibrating ${rem}s`, at: nowMs });
                return { state, feedback, repCompleted };
            }
            state.scratch.baselineHeelY = state.scratch.calibHeelYSum / Math.max(1, state.scratch.calibFrames);
            state.phase = "READY";
        }
        const rise = state.scratch.baselineHeelY - smoothHeelY; // positive when heel is up
        if (state.phase === "READY" && rise > RISE_THRESH + HYSTERESIS) {
            state.phase = "ASCENDING";
            state.scratch.repStartAt = nowMs;
            state.scratch.maxRise = rise;
        }
        else if (state.phase === "ASCENDING") {
            if (rise > state.scratch.maxRise)
                state.scratch.maxRise = rise;
            if (rise >= PEAK_THRESH + HYSTERESIS)
                state.phase = "TOP";
        }
        else if (state.phase === "TOP") {
            if (rise > state.scratch.maxRise)
                state.scratch.maxRise = rise;
            if (rise < PEAK_THRESH - HYSTERESIS)
                state.phase = "DESCENDING";
        }
        else if (state.phase === "DESCENDING") {
            if (rise < RETURN_THRESH - HYSTERESIS) {
                state.reps += 1;
                repCompleted = true;
                state.repLog = [
                    ...state.repLog,
                    {
                        repIndex: state.reps,
                        tempoSec: Number(((nowMs - state.scratch.repStartAt) / 1000).toFixed(2)),
                        metrics: { maxRise: Number((state.scratch.maxRise * 100).toFixed(1)) },
                    },
                ];
                if (state.reps >= REP_TARGET) {
                    feedback.push({ id: "set-complete", severity: "good", message: `Set complete — ${REP_TARGET} reps!`, at: nowMs });
                }
                else if (state.scratch.maxRise < PEAK_THRESH) {
                    feedback.push({ id: "rom", severity: "warn", message: "Rise higher for full range of motion", at: nowMs });
                }
                else {
                    feedback.push({ id: "rep-good", severity: "good", message: `Rep ${state.reps} — great!`, at: nowMs });
                }
                state.phase = "READY";
                state.scratch.maxRise = 0;
            }
        }
        return { state, feedback, repCompleted };
    },
};
