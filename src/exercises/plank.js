import { angleDeg, RollingMedian, visible } from "../lib/geometry";
import { LM } from "../lib/pose";
const CALIBRATION_MS = 2000;
const HOLD_TARGET_SEC = 60;
const START_ALIGNMENT_TOL = 25;
const MAX_HIP_SAG_ANGLE = 160;
const MAX_PIKE_ANGLE = 198;
const bodyLineSmoother = new RollingMedian(5);
function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
}
function holdScore(holdSec, avgBodyDeviation, maxSagDeg) {
    const timeScore = 100 * clamp(holdSec / HOLD_TARGET_SEC, 0, 1);
    const alignmentScore = 100 * clamp(1 - avgBodyDeviation / 20, 0, 1);
    const sagScore = 100 * clamp(1 - maxSagDeg / 20, 0, 1);
    return Math.round(0.40 * timeScore + 0.40 * alignmentScore + 0.20 * sagScore);
}
export const plank = {
    id: "plank",
    label: "Plank",
    icon: "🧘",
    category: "Upper Body",
    targetCount: HOLD_TARGET_SEC,
    counterUnit: "s",
    supportedViews: ["side-left", "side-right"],
    setupTip: "Set camera to your side. Hold a straight shoulder-hip-ankle line and keep your full body in frame.",
    initialState() {
        bodyLineSmoother.reset();
        return {
            phase: "CALIBRATING",
            reps: 0,
            repLog: [],
            scratch: {
                calibStartAt: -1,
                calibFrames: 0,
                calibBodyLineSum: 0,
                baselineBodyLine: 180,
                holdStartAt: -1,
                holdSec: 0,
                alignmentDeviationSum: 0,
                alignmentFrames: 0,
                maxSagDeg: 0,
                hit15: 0,
                hit30: 0,
                hit45: 0,
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
        const useLeft = viewAngle === "side-left" ||
            (viewAngle !== "side-right" &&
                (landmarks[LM.LEFT_SHOULDER].visibility ?? 0) >=
                    (landmarks[LM.RIGHT_SHOULDER].visibility ?? 0));
        const shoulder = useLeft ? landmarks[LM.LEFT_SHOULDER] : landmarks[LM.RIGHT_SHOULDER];
        const hip = useLeft ? landmarks[LM.LEFT_HIP] : landmarks[LM.RIGHT_HIP];
        const ankle = useLeft ? landmarks[LM.LEFT_ANKLE] : landmarks[LM.RIGHT_ANKLE];
        const elbow = useLeft ? landmarks[LM.LEFT_ELBOW] : landmarks[LM.RIGHT_ELBOW];
        const ear = useLeft ? landmarks[LM.LEFT_EAR] : landmarks[LM.RIGHT_EAR];
        if (!visible([shoulder, hip, ankle, elbow], 0.4)) {
            feedback.push({
                id: "no-pose",
                severity: "warn",
                message: "Keep your side profile fully visible",
                at: nowMs,
            });
            return { state, feedback, repCompleted };
        }
        const bodyLine = bodyLineSmoother.push(angleDeg(shoulder, hip, ankle));
        if (Number.isNaN(bodyLine)) {
            feedback.push({ id: "no-pose", severity: "warn", message: "Reposition in frame", at: nowMs });
            return { state, feedback, repCompleted };
        }
        const bodyDeviation = Math.abs(180 - bodyLine);
        if (state.phase === "CALIBRATING") {
            if (state.scratch.calibStartAt < 0)
                state.scratch.calibStartAt = nowMs;
            const elapsed = nowMs - state.scratch.calibStartAt;
            state.scratch.calibBodyLineSum += bodyLine;
            state.scratch.calibFrames += 1;
            if (elapsed < CALIBRATION_MS) {
                const rem = Math.ceil((CALIBRATION_MS - elapsed) / 1000);
                feedback.push({
                    id: "calibrating",
                    severity: "warn",
                    message: `Hold steady — calibrating ${rem}s`,
                    at: nowMs,
                });
                return { state, feedback, repCompleted };
            }
            state.scratch.baselineBodyLine =
                state.scratch.calibBodyLineSum / Math.max(1, state.scratch.calibFrames);
            state.phase = "READY";
        }
        if (state.phase === "READY") {
            if (bodyDeviation <= START_ALIGNMENT_TOL) {
                state.phase = "HOLDING";
                state.scratch.holdStartAt = nowMs;
                state.scratch.holdSec = 0;
                state.scratch.alignmentDeviationSum = 0;
                state.scratch.alignmentFrames = 0;
                state.scratch.maxSagDeg = 0;
                state.scratch.hit15 = 0;
                state.scratch.hit30 = 0;
                state.scratch.hit45 = 0;
            }
            else {
                feedback.push({
                    id: "ready-shape",
                    severity: "warn",
                    message: "Find a straight plank line to start",
                    at: nowMs,
                });
            }
            return { state, feedback, repCompleted };
        }
        if (state.phase === "HOLDING") {
            const holdSec = (nowMs - state.scratch.holdStartAt) / 1000;
            state.scratch.holdSec = Number(holdSec.toFixed(1));
            state.scratch.alignmentDeviationSum += bodyDeviation;
            state.scratch.alignmentFrames += 1;
            if (bodyLine < MAX_HIP_SAG_ANGLE) {
                const sag = MAX_HIP_SAG_ANGLE - bodyLine;
                if (sag > state.scratch.maxSagDeg)
                    state.scratch.maxSagDeg = sag;
                feedback.push({
                    id: "hip-sag",
                    severity: "error",
                    message: "Hips are dropping — brace your core",
                    at: nowMs,
                });
            }
            else if (bodyLine > MAX_PIKE_ANGLE) {
                feedback.push({
                    id: "hip-pike",
                    severity: "warn",
                    message: "Lower your hips — keep a straight line",
                    at: nowMs,
                });
            }
            if (visible([ear], 0.3) && angleDeg(ear, shoulder, hip) < 145) {
                feedback.push({ id: "neck-neutral", severity: "warn", message: "Keep neck neutral — look at the floor", at: nowMs });
            }
            if (holdSec >= 15 && state.scratch.hit15 === 0) {
                state.scratch.hit15 = 1;
                feedback.push({ id: "milestone-15", severity: "good", message: "15 seconds — strong start", at: nowMs });
            }
            if (holdSec >= 30 && state.scratch.hit30 === 0) {
                state.scratch.hit30 = 1;
                feedback.push({ id: "milestone-30", severity: "good", message: "30 seconds — keep breathing", at: nowMs });
            }
            if (holdSec >= 45 && state.scratch.hit45 === 0) {
                state.scratch.hit45 = 1;
                feedback.push({ id: "milestone-45", severity: "good", message: "45 seconds — finish strong", at: nowMs });
            }
            if (holdSec >= HOLD_TARGET_SEC) {
                const avgBodyDeviation = state.scratch.alignmentDeviationSum / Math.max(1, state.scratch.alignmentFrames);
                const score = holdScore(HOLD_TARGET_SEC, avgBodyDeviation, state.scratch.maxSagDeg);
                state.reps = 1;
                repCompleted = true;
                state.repLog = [
                    ...state.repLog,
                    {
                        repIndex: 1,
                        tempoSec: HOLD_TARGET_SEC,
                        metrics: {
                            holdSec: HOLD_TARGET_SEC,
                            avgBodyDeviation: Number(avgBodyDeviation.toFixed(1)),
                            maxSagDeg: Number(state.scratch.maxSagDeg.toFixed(1)),
                            score,
                        },
                    },
                ];
                feedback.push({
                    id: "set-complete",
                    severity: "good",
                    message: `Plank complete — ${HOLD_TARGET_SEC}s hold!`,
                    at: nowMs,
                });
                state.phase = "READY";
            }
        }
        return { state, feedback, repCompleted };
    },
};
