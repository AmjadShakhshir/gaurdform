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
const CALIBRATION_MS = 2500;

// Hinge = torso angle from vertical; knee = hip-knee-ankle
const HINGE_THRESH   = 35;  // torso must lean this much to be "in position"
const HINGE_WARN     = 40;  // early back rounding warning
const HINGE_MAX_WARN = 50;  // excessive rounding
const KNEE_DESC      = 150; // below → knee bending (descend)
const KNEE_BOTTOM    =  85;
const KNEE_ASCEND    = 110;
const KNEE_TOP       = 160; // above → rep complete (lockout)

const REP_TARGET  = 10;
const HYSTERESIS  = 5;

// ── Module-level smoothers ─────────────────────────────────────────────────────
const kneeSmoother  = new RollingMedian(5);
const torsoSmoother = new RollingMedian(5);

export const deadlift: ExerciseDefinition = {
  id: "deadlift",
  label: "Deadlift",
  icon: "🏋️",
  category: "Compound",
  supportedViews: ["side-left", "side-right"],
  setupTip: "Stand sideways to the camera. Bar over mid-foot. Hold still 2.5 s for calibration.",

  initialState(): ExerciseState {
    kneeSmoother.reset();
    torsoSmoother.reset();
    return {
      phase: "CALIBRATING",
      reps: 0,
      repLog: [],
      scratch: {
        calibStartAt: -1,
        calibFrames: 0,
        calibShoulderYSum: 0,
        baselineShoulderY: -1,
        minKnee: 180,
        maxTorso: 0,
        repStartAt: 0,
      },
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

    const useLeft = viewAngle === "side-left" || (landmarks[LM.LEFT_HIP].visibility ?? 0) >= (landmarks[LM.RIGHT_HIP].visibility ?? 0);
    const sh     = useLeft ? landmarks[LM.LEFT_SHOULDER] : landmarks[LM.RIGHT_SHOULDER];
    const hip    = useLeft ? landmarks[LM.LEFT_HIP]      : landmarks[LM.RIGHT_HIP];
    const knee   = useLeft ? landmarks[LM.LEFT_KNEE]     : landmarks[LM.RIGHT_KNEE];
    const ankle  = useLeft ? landmarks[LM.LEFT_ANKLE]    : landmarks[LM.RIGHT_ANKLE];
    const ear    = useLeft ? landmarks[LM.LEFT_EAR]      : landmarks[LM.RIGHT_EAR];

    if (!visible([sh, hip, knee, ankle], 0.40)) {
      feedback.push({ id: "no-pose", severity: "warn", message: "Stand sideways — keep full body visible", at: nowMs });
      return { state, feedback, repCompleted };
    }

    // ── CALIBRATING ────────────────────────────────────────────────────────────
    if (state.phase === "CALIBRATING") {
      if (state.scratch.calibStartAt < 0) state.scratch.calibStartAt = nowMs;
      const elapsed = nowMs - state.scratch.calibStartAt;
      state.scratch.calibShoulderYSum += sh.y;
      state.scratch.calibFrames       += 1;
      if (elapsed < CALIBRATION_MS) {
        const rem = Math.ceil((CALIBRATION_MS - elapsed) / 1000);
        feedback.push({ id: "calibrating", severity: "warn", message: `Hold still — calibrating ${rem}s`, at: nowMs });
        return { state, feedback, repCompleted };
      }
      state.scratch.baselineShoulderY = state.scratch.calibShoulderYSum / Math.max(1, state.scratch.calibFrames);
      state.phase = "READY";
    }

    const vertUp   = { x: hip.x, y: hip.y - 0.2 };
    const torsoAng = torsoSmoother.push(angleDeg(sh, hip, vertUp));
    const kneeAng  = kneeSmoother.push(angleDeg(hip, knee, ankle));

    if (state.phase === "READY" && kneeAng < KNEE_DESC - HYSTERESIS && torsoAng > HINGE_THRESH) {
      state.phase = "DESCENDING";
      state.scratch.repStartAt = nowMs;
      state.scratch.minKnee    = kneeAng;
      state.scratch.maxTorso   = torsoAng;
    } else if (state.phase === "DESCENDING") {
      if (kneeAng < state.scratch.minKnee) state.scratch.minKnee = kneeAng;
      if (torsoAng > state.scratch.maxTorso) state.scratch.maxTorso = torsoAng;
      if (kneeAng < KNEE_BOTTOM - HYSTERESIS) state.phase = "BOTTOM";
    } else if (state.phase === "BOTTOM") {
      if (kneeAng < state.scratch.minKnee) state.scratch.minKnee = kneeAng;
      if (kneeAng > KNEE_ASCEND + HYSTERESIS) state.phase = "ASCENDING";
    } else if (state.phase === "ASCENDING") {
      if (kneeAng > KNEE_TOP + HYSTERESIS) {
        state.reps += 1;
        repCompleted = true;
        state.repLog = [
          ...state.repLog,
          {
            repIndex: state.reps,
            tempoSec: Number(((nowMs - state.scratch.repStartAt) / 1000).toFixed(2)),
            metrics: {
              minKneeAngle: Number(state.scratch.minKnee.toFixed(1)),
              maxTorsoAngle: Number(state.scratch.maxTorso.toFixed(1)),
            },
          },
        ];
        if (state.reps >= REP_TARGET) {
          feedback.push({ id: "set-complete", severity: "good", message: `Set complete — ${REP_TARGET} reps!`, at: nowMs });
        } else {
          feedback.push({ id: "rep-good", severity: "good", message: `Rep ${state.reps} — locked out!`, at: nowMs });
        }
        state.phase = "READY";
        state.scratch.minKnee = 180;
        state.scratch.maxTorso = 0;
      }
    }

    const inRep = state.phase !== "READY";
    if (inRep && torsoAng > HINGE_MAX_WARN) {
      feedback.push({ id: "back-round", severity: "error", message: "Back is rounding — brace and lift your chest", at: nowMs });
    } else if (inRep && torsoAng > HINGE_WARN) {
      feedback.push({ id: "back-round", severity: "warn", message: "Chest up — back is starting to round", at: nowMs });
    }
    if (inRep && visible([ear], 0.3) && angleDeg(ear, sh, hip) < 140) {
      feedback.push({ id: "neck-neutral", severity: "warn", message: "Keep neck neutral — don't crane up", at: nowMs });
    }

    return { state, feedback, repCompleted };
  },
};
