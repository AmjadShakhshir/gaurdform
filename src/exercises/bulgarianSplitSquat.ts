import { angleDeg, RollingMedian, visible } from "../lib/geometry";
import { LM, type Landmarks } from "../lib/pose";
import type { ViewAngle } from "../lib/viewAngle";
import type {
  ExerciseDefinition,
  ExerciseState,
  EvalResult,
  Feedback,
} from "./types";

// ── Thresholds ─────────────────────────────────────────────────────────────────
const DESC_KNEE   = 150; // below → descending
const BOTTOM_KNEE = 100; // below → at bottom
const ASCEND_KNEE = 120; // above (from bottom) → ascending
const TOP_KNEE    = 155; // above → rep complete

const WARN_DEPTH   = 110;
const MAX_LEAN_DEG = 25;   // forward torso lean
const REP_TARGET   = 10;
const HYSTERESIS   = 5;

// ── Module-level smoother ──────────────────────────────────────────────────────
const kneeSmoother = new RollingMedian(5);

export const bulgarianSplitSquat: ExerciseDefinition = {
  id: "bulgarianSplitSquat",
  label: "Bulgarian Split Squat",
  icon: "🦵",
  category: "Legs",
  supportedViews: ["front", "side-left", "side-right"],
  setupTip: "Stand sideways or facing camera. Rear foot elevated. Front knee over toes.",

  initialState(): ExerciseState {
    kneeSmoother.reset();
    return {
      phase: "READY",
      reps: 0,
      repLog: [],
      scratch: { minKnee: 180, maxBackLean: 0, repStartAt: 0 },
    };
  },

  evaluate(
    landmarks: Landmarks,
    prev: ExerciseState,
    nowMs: number,
    viewAngle: ViewAngle,
  ): EvalResult {
    const state: ExerciseState = { ...prev, repLog: prev.repLog, scratch: { ...prev.scratch } };
    const feedback: Feedback[] = [];
    let repCompleted = false;

    if (!landmarks || landmarks.length === 0) {
      feedback.push({ id: "no-pose", severity: "warn", message: "Step into frame", at: nowMs });
      return { state, feedback, repCompleted };
    }

    const lHip   = landmarks[LM.LEFT_HIP];
    const rHip   = landmarks[LM.RIGHT_HIP];
    const lKnee  = landmarks[LM.LEFT_KNEE];
    const rKnee  = landmarks[LM.RIGHT_KNEE];
    const lAnkle = landmarks[LM.LEFT_ANKLE];
    const rAnkle = landmarks[LM.RIGHT_ANKLE];
    const lSh    = landmarks[LM.LEFT_SHOULDER];
    const rSh    = landmarks[LM.RIGHT_SHOULDER];

    if (!visible([lHip, rHip, lKnee, rKnee], 0.35)) {
      feedback.push({ id: "no-pose", severity: "warn", message: "Keep full body in frame", at: nowMs });
      return { state, feedback, repCompleted };
    }

    // Front knee = the one with the lower ankle (higher normalized Y = lower on screen in MediaPipe)
    const useFrontLeft = (lAnkle.y > rAnkle.y);
    const frontHip    = useFrontLeft ? lHip   : rHip;
    const frontKnee   = useFrontLeft ? lKnee  : rKnee;
    const frontAnkle  = useFrontLeft ? lAnkle : rAnkle;

    const kneeAng = kneeSmoother.push(angleDeg(frontHip, frontKnee, frontAnkle));

    const shMid  = { x: (lSh.x + rSh.x) / 2, y: (lSh.y + rSh.y) / 2 };
    const hpMid  = { x: (lHip.x + rHip.x) / 2, y: (lHip.y + rHip.y) / 2 };
    const vertUp = { x: hpMid.x, y: hpMid.y - 0.2 };
    const backLean = angleDeg(shMid, hpMid, vertUp);

    if (state.phase === "READY" && kneeAng < DESC_KNEE - HYSTERESIS) {
      state.phase = "DESCENDING";
      state.scratch.repStartAt  = nowMs;
      state.scratch.minKnee     = kneeAng;
      state.scratch.maxBackLean = backLean;
    } else if (state.phase === "DESCENDING") {
      if (kneeAng < state.scratch.minKnee) state.scratch.minKnee = kneeAng;
      if (backLean > state.scratch.maxBackLean) state.scratch.maxBackLean = backLean;
      if (kneeAng < BOTTOM_KNEE - HYSTERESIS) state.phase = "BOTTOM";
    } else if (state.phase === "BOTTOM") {
      if (kneeAng < state.scratch.minKnee) state.scratch.minKnee = kneeAng;
      if (kneeAng > ASCEND_KNEE + HYSTERESIS) state.phase = "ASCENDING";
    } else if (state.phase === "ASCENDING") {
      if (kneeAng > TOP_KNEE + HYSTERESIS) {
        state.reps += 1;
        repCompleted = true;
        state.repLog = [
          ...state.repLog,
          {
            repIndex: state.reps,
            tempoSec: Number(((nowMs - state.scratch.repStartAt) / 1000).toFixed(2)),
            metrics: {
              minKneeAngle: Number(state.scratch.minKnee.toFixed(1)),
              maxBackLean:  Number(state.scratch.maxBackLean.toFixed(1)),
            },
          },
        ];
        if (state.reps >= REP_TARGET) {
          feedback.push({ id: "set-complete", severity: "good", message: `Set complete — ${REP_TARGET} reps!`, at: nowMs });
        } else if (state.scratch.minKnee > WARN_DEPTH) {
          feedback.push({ id: "depth", severity: "warn", message: "Drop lower — thigh parallel to floor", at: nowMs });
        } else {
          feedback.push({ id: "rep-good", severity: "good", message: `Rep ${state.reps} — ${Math.round(state.scratch.minKnee)}°`, at: nowMs });
        }
        state.phase = "READY";
        state.scratch.minKnee = 180;
        state.scratch.maxBackLean = 0;
      }
    }

    const inRep = state.phase !== "READY";
    if (inRep && backLean > MAX_LEAN_DEG) {
      feedback.push({ id: "forward-lean", severity: "warn", message: "Keep torso more upright", at: nowMs });
    }
    // Knee valgus — front view only
    if (inRep && viewAngle === "front") {
      const frontKneeX  = useFrontLeft ? lKnee.x  : rKnee.x;
      const frontAnkleX = useFrontLeft ? lAnkle.x : rAnkle.x;
      const backKneeX   = useFrontLeft ? rKnee.x  : lKnee.x;
      const kneeW  = Math.abs(frontKneeX - backKneeX);
      const ankleW = Math.abs(frontAnkleX - (useFrontLeft ? rAnkle.x : lAnkle.x));
      if (ankleW > 0.01 && kneeW / ankleW < 0.75) {
        feedback.push({ id: "knee-cave", severity: "error", message: "Front knee caving — push it out", at: nowMs });
      }
    }

    return { state, feedback, repCompleted };
  },
};
