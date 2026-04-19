import { angleDeg, RollingMedian, visible } from "../lib/geometry";
import { LM } from "../lib/pose";
// ── Thresholds ─────────────────────────────────────────────────────────────────
const HINGE_START = 25; // torso degrees from vertical → start of hinge
const HINGE_BOTTOM = 40; // ≥ this at bottom for good depth
const HINGE_ASCEND = 30; // above this (on way up) → ascending
const HINGE_TOP = 15; // back to standing
const MAX_KNEE_CHANGE = 15; // knee angle should stay consistent during RDL
const BACK_ROUND_WARN = 65; // torso angle — avoid rounding beyond here
const REP_TARGET = 10;
const HYSTERESIS = 3; // small — RDL thresholds are compact
// ── Module-level smoothers ─────────────────────────────────────────────────────
const torsoSmoother = new RollingMedian(5);
const kneeSmoother = new RollingMedian(5);
export const rdl = {
    id: "rdl",
    label: "RDL",
    icon: "🔄",
    category: "Legs",
    supportedViews: ["side-left", "side-right"],
    setupTip: "Stand sideways to the camera, ~2 m away. Full body in frame.",
    initialState() {
        torsoSmoother.reset();
        kneeSmoother.reset();
        return {
            phase: "READY",
            reps: 0,
            repLog: [],
            scratch: {
                minHinge: 0,
                maxHinge: 0,
                repStartAt: 0,
                kneeAtStart: -1,
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
        const useLeft = viewAngle === "side-left" || (landmarks[LM.LEFT_HIP].visibility ?? 0) >= (landmarks[LM.RIGHT_HIP].visibility ?? 0);
        const hip = useLeft ? landmarks[LM.LEFT_HIP] : landmarks[LM.RIGHT_HIP];
        const knee = useLeft ? landmarks[LM.LEFT_KNEE] : landmarks[LM.RIGHT_KNEE];
        const ankle = useLeft ? landmarks[LM.LEFT_ANKLE] : landmarks[LM.RIGHT_ANKLE];
        const sh = useLeft ? landmarks[LM.LEFT_SHOULDER] : landmarks[LM.RIGHT_SHOULDER];
        const ear = useLeft ? landmarks[LM.LEFT_EAR] : landmarks[LM.RIGHT_EAR];
        if (!visible([hip, knee, ankle, sh], 0.40)) {
            feedback.push({ id: "no-pose", severity: "warn", message: "Stand sideways — keep full body in frame", at: nowMs });
            return { state, feedback, repCompleted };
        }
        const vertUp = { x: hip.x, y: hip.y - 0.2 };
        const torsoAng = torsoSmoother.push(angleDeg(sh, hip, vertUp));
        const kneeAng = kneeSmoother.push(angleDeg(hip, knee, ankle));
        if (state.phase === "READY" && torsoAng > HINGE_START + HYSTERESIS) {
            state.phase = "DESCENDING";
            state.scratch.repStartAt = nowMs;
            state.scratch.maxHinge = torsoAng;
            state.scratch.kneeAtStart = kneeAng;
        }
        else if (state.phase === "DESCENDING") {
            if (torsoAng > state.scratch.maxHinge)
                state.scratch.maxHinge = torsoAng;
            if (torsoAng >= HINGE_BOTTOM + HYSTERESIS)
                state.phase = "BOTTOM";
        }
        else if (state.phase === "BOTTOM") {
            if (torsoAng > state.scratch.maxHinge)
                state.scratch.maxHinge = torsoAng;
            if (torsoAng < HINGE_ASCEND - HYSTERESIS)
                state.phase = "ASCENDING";
        }
        else if (state.phase === "ASCENDING") {
            if (torsoAng < HINGE_TOP - HYSTERESIS) {
                state.reps += 1;
                repCompleted = true;
                state.repLog = [
                    ...state.repLog,
                    {
                        repIndex: state.reps,
                        tempoSec: Number(((nowMs - state.scratch.repStartAt) / 1000).toFixed(2)),
                        metrics: { maxHinge: Number(state.scratch.maxHinge.toFixed(1)) },
                    },
                ];
                if (state.reps >= REP_TARGET) {
                    feedback.push({ id: "set-complete", severity: "good", message: `Set complete — ${REP_TARGET} reps!`, at: nowMs });
                }
                else if (state.scratch.maxHinge < HINGE_BOTTOM) {
                    feedback.push({ id: "depth", severity: "warn", message: "Hinge deeper — feel the hamstrings stretch", at: nowMs });
                }
                else {
                    feedback.push({ id: "rep-good", severity: "good", message: `Rep ${state.reps} — good hinge!`, at: nowMs });
                }
                state.phase = "READY";
                state.scratch.maxHinge = 0;
                state.scratch.kneeAtStart = -1;
            }
        }
        const inRep = state.phase !== "READY";
        if (inRep && state.scratch.kneeAtStart > 0 && Math.abs(kneeAng - state.scratch.kneeAtStart) > MAX_KNEE_CHANGE) {
            feedback.push({ id: "knee-bend", severity: "warn", message: "Keep a soft, consistent knee bend", at: nowMs });
        }
        if ((state.phase === "DESCENDING" || state.phase === "BOTTOM") && torsoAng > BACK_ROUND_WARN) {
            feedback.push({ id: "back-round", severity: "warn", message: "Avoid rounding — hinge at the hips", at: nowMs });
        }
        if (inRep && visible([ear], 0.3) && angleDeg(ear, sh, hip) < 140) {
            feedback.push({ id: "neck-neutral", severity: "warn", message: "Keep neck neutral", at: nowMs });
        }
        return { state, feedback, repCompleted };
    },
};
