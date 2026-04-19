import { angleDeg, RollingMedian, visible } from "../lib/geometry";
import { LM } from "../lib/pose";
// ── Thresholds ─────────────────────────────────────────────────────────────────
const EXTENDED = 160; // arm fully extended (start / end of rep)
const CONTRACTED = 60; // arm fully curled
const DESC_FROM_TOP = 80; // after peak, angle > this → returning
const MIN_TEMPO_SEC = 1.2; // reps faster than this get a tempo warning
const ELBOW_DRIFT_X = 0.10; // normalized image-width elbow-drift threshold
/** Shoulder hike expressed as a fraction of torso length — camera-distance independent. */
const SHOULDER_HIKE_NORM = 0.15;
/** Consecutive frames above threshold before warning fires (hysteresis). */
const SHOULDER_HIKE_FRAMES = 5;
const CALIBRATION_MS = 2000; // 2-second hold-still window for baseline capture
const REP_TARGET = 10; // auto-stop after this many clean reps
const HYSTERESIS = 5; // degree dead-band on phase transitions
// ── Landmark index sets for each arm (0 = right, 1 = left) ───────────────────
const SIDE_LM = [
    { shoulder: LM.RIGHT_SHOULDER, elbow: LM.RIGHT_ELBOW, wrist: LM.RIGHT_WRIST, hip: LM.RIGHT_HIP },
    { shoulder: LM.LEFT_SHOULDER, elbow: LM.LEFT_ELBOW, wrist: LM.LEFT_WRIST, hip: LM.LEFT_HIP },
];
// ── Module-level smoothers (reset each session) ───────────────────────────────
const elbowSmoother = new RollingMedian(5);
const shoulderSmoother = new RollingMedian(5);
// ── Quality score (0–100) per rep ─────────────────────────────────────────────
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function repQuality(minElbow, tempoSec, maxDrift, maxHike) {
    const rom = 100 * clamp((160 - minElbow) / (160 - 60), 0, 1); // 40 %
    const tempo = 100 * clamp(1 - Math.abs(tempoSec - 2.0) / 1.5, 0, 1); // 30 %
    const drift = 100 * clamp(1 - maxDrift / 0.15, 0, 1); // 20 %
    const shoulder = 100 * clamp(1 - maxHike / 0.20, 0, 1); // 10 %
    return Math.round(0.4 * rom + 0.3 * tempo + 0.2 * drift + 0.1 * shoulder);
}
const GOOD_MESSAGES = ["Clean curl!", "Nice rep!", "Strong form!", "Great control!"];
export const bicepCurl = {
    id: "bicepCurl",
    label: "Bicep Curl",
    icon: "💪",
    category: "Upper Body",
    supportedViews: ["front"],
    setupTip: "Face the camera, elbow at your side. Hold still for 2 s — FormGuard auto-calibrates your baseline.",
    initialState() {
        elbowSmoother.reset();
        shoulderSmoother.reset();
        return {
            phase: "CALIBRATING",
            reps: 0,
            repLog: [],
            scratch: {
                // ── calibration accumulators ──
                calibStartAt: -1,
                calibFrames: 0,
                calibRShoulderSum: 0,
                calibLShoulderSum: 0,
                rightVisSum: 0,
                leftVisSum: 0,
                // ── detected dominant side (0 = right, 1 = left) ──
                side: 0,
                // ── baselines ──
                restingElbowX: -1,
                restingShoulderY: -1,
                torsoLength: -1,
                // ── per-rep accumulators ──
                minElbow: 180,
                maxElbowDriftX: 0,
                maxShoulderHikeY: 0,
                shoulderHikeFrames: 0,
                repStartAt: 0,
            },
        };
    },
    evaluate(landmarks, prev, nowMs, _viewAngle) {
        const state = {
            ...prev,
            repLog: prev.repLog,
            scratch: { ...prev.scratch },
        };
        const feedback = [];
        let repCompleted = false;
        // Need at least hip landmarks (index 24) for torso-length normalization.
        if (!landmarks || landmarks.length < 29) {
            feedback.push({ id: "no-pose", severity: "warn", message: "Step into frame", at: nowMs });
            return { state, feedback, repCompleted };
        }
        // ── CALIBRATING phase ──────────────────────────────────────────────────────
        if (state.phase === "CALIBRATING") {
            const rSh = landmarks[LM.RIGHT_SHOULDER];
            const lSh = landmarks[LM.LEFT_SHOULDER];
            const rEl = landmarks[LM.RIGHT_ELBOW];
            const lEl = landmarks[LM.LEFT_ELBOW];
            const rWr = landmarks[LM.RIGHT_WRIST];
            const rightOk = visible([rSh, rEl, rWr], 0.4);
            const leftOk = visible([lSh, lEl], 0.4);
            if (!rightOk && !leftOk) {
                feedback.push({ id: "no-pose", severity: "warn", message: "Step into frame", at: nowMs });
                return { state, feedback, repCompleted };
            }
            if (state.scratch.calibStartAt < 0)
                state.scratch.calibStartAt = nowMs;
            const elapsed = nowMs - state.scratch.calibStartAt;
            // Accumulate per-side visibility scores to pick the dominant arm.
            state.scratch.rightVisSum += (rSh.visibility ?? 0) + (rEl.visibility ?? 0);
            state.scratch.leftVisSum += (lSh.visibility ?? 0) + (lEl.visibility ?? 0);
            // Accumulate shoulder Y for both sides.
            state.scratch.calibRShoulderSum += rSh.y;
            state.scratch.calibLShoulderSum += lSh.y;
            state.scratch.calibFrames += 1;
            if (elapsed < CALIBRATION_MS) {
                const remaining = Math.ceil((CALIBRATION_MS - elapsed) / 1000);
                feedback.push({
                    id: "calibrating",
                    severity: "warn",
                    message: `Hold still — ${remaining}s`,
                    at: nowMs,
                });
                return { state, feedback, repCompleted };
            }
            // ── Calibration complete — pick dominant side & lock in baselines ────────
            const chosenSide = state.scratch.leftVisSum > state.scratch.rightVisSum ? 1 : 0;
            state.scratch.side = chosenSide;
            const frames = Math.max(1, state.scratch.calibFrames);
            state.scratch.restingShoulderY =
                chosenSide === 0
                    ? state.scratch.calibRShoulderSum / frames
                    : state.scratch.calibLShoulderSum / frames;
            const chosenLM = SIDE_LM[chosenSide];
            state.scratch.restingElbowX = landmarks[chosenLM.elbow].x;
            const chosenSh = landmarks[chosenLM.shoulder];
            const chosenHp = landmarks[chosenLM.hip];
            const torso = Math.abs(chosenSh.y - chosenHp.y);
            state.scratch.torsoLength = torso > 0.05 ? torso : 0.20;
            state.scratch.shoulderHikeFrames = 0;
            state.phase = "READY";
            // Fall through to active-phase processing in the same frame.
        }
        // ── Active phase processing (READY / DESCENDING / BOTTOM / ASCENDING) ──────
        const side = state.scratch.side ?? 0;
        const sideLM = SIDE_LM[side];
        const sh = landmarks[sideLM.shoulder];
        const el = landmarks[sideLM.elbow];
        const wr = landmarks[sideLM.wrist];
        const hp = landmarks[sideLM.hip];
        if (!visible([sh, el, wr], 0.5)) {
            feedback.push({ id: "low-visibility", severity: "warn", message: "Keep your arm visible", at: nowMs });
            return { state, feedback, repCompleted };
        }
        // Push each smoother exactly once per frame.
        const smoothedShoulderY = shoulderSmoother.push(sh.y);
        const elbowAng = elbowSmoother.push(angleDeg(sh, el, wr));
        // Rolling EMA baseline during READY so slow camera drift doesn't accumulate.
        if (state.phase === "READY") {
            state.scratch.restingShoulderY =
                0.95 * state.scratch.restingShoulderY + 0.05 * smoothedShoulderY;
            const torso = Math.abs(sh.y - hp.y);
            if (torso > 0.05) {
                state.scratch.torsoLength = 0.95 * state.scratch.torsoLength + 0.05 * torso;
            }
        }
        // ── Phase transitions ──────────────────────────────────────────────────────
        if (state.phase === "READY" && elbowAng < EXTENDED - HYSTERESIS) {
            state.phase = "DESCENDING";
            state.scratch.repStartAt = nowMs;
            state.scratch.minElbow = elbowAng;
            state.scratch.maxElbowDriftX = 0;
            state.scratch.maxShoulderHikeY = 0;
            state.scratch.shoulderHikeFrames = 0;
        }
        else if (state.phase === "DESCENDING") {
            if (elbowAng < state.scratch.minElbow)
                state.scratch.minElbow = elbowAng;
            if (elbowAng < CONTRACTED - HYSTERESIS)
                state.phase = "BOTTOM";
        }
        else if (state.phase === "BOTTOM") {
            if (elbowAng < state.scratch.minElbow)
                state.scratch.minElbow = elbowAng;
            if (elbowAng > DESC_FROM_TOP + HYSTERESIS)
                state.phase = "ASCENDING";
        }
        else if (state.phase === "ASCENDING") {
            if (elbowAng > EXTENDED + HYSTERESIS) {
                if (state.scratch.minElbow <= CONTRACTED + 5) {
                    state.reps += 1;
                    repCompleted = true;
                    const tempoSec = (nowMs - state.scratch.repStartAt) / 1000;
                    const score = repQuality(state.scratch.minElbow, tempoSec, state.scratch.maxElbowDriftX, state.scratch.maxShoulderHikeY);
                    if (state.reps >= REP_TARGET) {
                        feedback.push({
                            id: "set-complete",
                            severity: "good",
                            message: `Set complete — ${REP_TARGET} reps! Great work!`,
                            at: nowMs,
                        });
                    }
                    else if (tempoSec < MIN_TEMPO_SEC) {
                        feedback.push({
                            id: "tempo",
                            severity: "warn",
                            message: "Slow down — control the weight",
                            at: nowMs,
                        });
                    }
                    else {
                        const msg = GOOD_MESSAGES[(state.reps - 1) % GOOD_MESSAGES.length];
                        feedback.push({
                            id: "rep-good",
                            severity: "good",
                            message: `Rep ${state.reps} — ${score}/100  ${msg}`,
                            at: nowMs,
                        });
                    }
                    state.repLog = [
                        ...state.repLog,
                        {
                            repIndex: state.reps,
                            tempoSec: Number(tempoSec.toFixed(2)),
                            metrics: {
                                minElbowAngle: Number(state.scratch.minElbow.toFixed(1)),
                                maxElbowDrift: Number(state.scratch.maxElbowDriftX.toFixed(3)),
                                maxShoulderHike: Number(state.scratch.maxShoulderHikeY.toFixed(3)),
                                score,
                            },
                        },
                    ];
                }
                else {
                    feedback.push({ id: "rom", severity: "warn", message: "Full range — curl higher", at: nowMs });
                }
                state.phase = "READY";
                state.scratch.minElbow = 180;
            }
        }
        // ── Live form rules ────────────────────────────────────────────────────────
        // Elbow drift vs. resting position.
        if (state.scratch.restingElbowX >= 0 && state.phase !== "READY") {
            const drift = Math.abs(el.x - state.scratch.restingElbowX);
            if (drift > state.scratch.maxElbowDriftX)
                state.scratch.maxElbowDriftX = drift;
            if (drift > ELBOW_DRIFT_X) {
                feedback.push({ id: "elbow-drift", severity: "error", message: "Keep elbow tucked", at: nowMs });
            }
        }
        // Shoulder hike — normalized by torso length + consecutive-frame hysteresis.
        if (state.scratch.restingShoulderY >= 0 &&
            state.scratch.torsoLength > 0 &&
            state.phase !== "READY") {
            const hikeNorm = (state.scratch.restingShoulderY - smoothedShoulderY) / state.scratch.torsoLength;
            if (hikeNorm > state.scratch.maxShoulderHikeY)
                state.scratch.maxShoulderHikeY = hikeNorm;
            if (hikeNorm > SHOULDER_HIKE_NORM) {
                state.scratch.shoulderHikeFrames += 1;
            }
            else {
                state.scratch.shoulderHikeFrames = 0;
            }
            if (state.scratch.shoulderHikeFrames >= SHOULDER_HIKE_FRAMES) {
                feedback.push({
                    id: "shoulder-hike",
                    severity: "warn",
                    message: "Watch that shoulder — keep it down",
                    at: nowMs,
                });
            }
        }
        return { state, feedback, repCompleted };
    },
};
