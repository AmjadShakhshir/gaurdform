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
const DESC_KNEE    = 155; // below → descending
const BOTTOM_KNEE  = 100; // below → at bottom
const ASCEND_KNEE  = 125; // above (from bottom) → ascending
const TOP_KNEE     = 160; // above → rep complete

const WARN_DEPTH_KNEE = 110; // "go deeper"
const MAX_TORSO_LEAN  = 25;  // degrees from vertical — keep upright
const HIP_DROP_THRESH = 0.03; // |lHip.y - rHip.y|

const REP_TARGET  = 10;
const HYSTERESIS  = 5;

// ── Module-level smoothers ─────────────────────────────────────────────────────
const lKneeSmoother = new RollingMedian(5);
const rKneeSmoother = new RollingMedian(5);

export const lunge: ExerciseDefinition = {
  id: "lunge",
  label: "Lunge",
  icon: "🚶",
  category: "Legs",
  supportedViews: ["front", "side-left", "side-right"],
  setupTip: "Stand ~2 m from camera. Face it or stand sideways. Step forward to lunge.",

  initialState(): ExerciseState {
    lKneeSmoother.reset();
    rKneeSmoother.reset();
    return {
      phase: "READY",
      reps: 0,
      repLog: [],
      scratch: {
        minKnee: 180,
        maxBackLean: 0,
        repStartAt: 0,
      },
    };
  },

  evaluate(
    landmarks: Landmarks,
    prev: ExerciseState,
    nowMs: number,
    _viewAngle: ViewAngle,
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

    if (!visible([lHip, rHip, lKnee, rKnee, lAnkle, rAnkle], 0.35)) {
      feedback.push({ id: "no-pose", severity: "warn", message: "Keep full body in frame", at: nowMs });
      return { state, feedback, repCompleted };
    }

    const lKneeAng = lKneeSmoother.push(angleDeg(lHip, lKnee, lAnkle));
    const rKneeAng = rKneeSmoother.push(angleDeg(rHip, rKnee, rAnkle));
    const minKnee  = Math.min(lKneeAng, rKneeAng);

    const shMid  = { x: (lSh.x + rSh.x) / 2, y: (lSh.y + rSh.y) / 2 };
    const hpMid  = { x: (lHip.x + rHip.x) / 2, y: (lHip.y + rHip.y) / 2 };
    const vertUp = { x: hpMid.x, y: hpMid.y - 0.2 };
    const backLean = angleDeg(shMid, hpMid, vertUp);

    // Phase state machine
    if (state.phase === "READY" && minKnee < DESC_KNEE - HYSTERESIS) {
      state.phase = "DESCENDING";
      state.scratch.repStartAt  = nowMs;
      state.scratch.minKnee     = minKnee;
      state.scratch.maxBackLean = backLean;
    } else if (state.phase === "DESCENDING") {
      if (minKnee < state.scratch.minKnee) state.scratch.minKnee = minKnee;
      if (backLean > state.scratch.maxBackLean) state.scratch.maxBackLean = backLean;
      if (minKnee < BOTTOM_KNEE - HYSTERESIS) state.phase = "BOTTOM";
    } else if (state.phase === "BOTTOM") {
      if (minKnee < state.scratch.minKnee) state.scratch.minKnee = minKnee;
      if (minKnee > ASCEND_KNEE + HYSTERESIS) state.phase = "ASCENDING";
    } else if (state.phase === "ASCENDING") {
      if (minKnee > TOP_KNEE + HYSTERESIS) {
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
        } else if (state.scratch.minKnee > WARN_DEPTH_KNEE) {
          feedback.push({ id: "depth", severity: "warn", message: "Lunge deeper next rep", at: nowMs });
        } else {
          feedback.push({ id: "rep-good", severity: "good", message: `Rep ${state.reps} — ${Math.round(state.scratch.minKnee)}°`, at: nowMs });
        }
        state.phase = "READY";
        state.scratch.minKnee = 180;
        state.scratch.maxBackLean = 0;
      }
    }

    const inRep = state.phase !== "READY";
    if (inRep) {
      if (backLean > MAX_TORSO_LEAN) {
        feedback.push({ id: "torso-lean", severity: "warn", message: "Keep torso upright", at: nowMs });
      }
      if (Math.abs(lHip.y - rHip.y) > HIP_DROP_THRESH) {
        feedback.push({ id: "hip-drop", severity: "warn", message: "Level your hips", at: nowMs });
      }
      // Knee valgus (front view)
      const kneeW  = Math.abs(lKnee.x - rKnee.x);
      const ankleW = Math.abs(lAnkle.x - rAnkle.x);
      if (ankleW > 0.01 && kneeW / ankleW < 0.75) {
        feedback.push({ id: "knee-cave", severity: "error", message: "Knees caving in — push them out", at: nowMs });
      }
    }

    return { state, feedback, repCompleted };
  },
};
