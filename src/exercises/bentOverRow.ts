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
const TORSO_BENT_MIN  = 35;  // must be this hinged to start the exercise
const TORSO_STABLE    = 10;  // max torso angle change during a pull
const ELBOW_START     = 150; // elbows extended at start
const ELBOW_TOP       =  70; // elbows fully pulled → top of pull
const ELBOW_RETURN    = 110; // returning to start

const REP_TARGET      = 10;
const BACK_ROUND_DELTA = 12; // torso angle increase during pull → rounding
const HYSTERESIS       = 5;

// ── Module-level smoothers ─────────────────────────────────────────────────────
const lElbowSmoother = new RollingMedian(5);
const rElbowSmoother = new RollingMedian(5);
const torsoSmoother  = new RollingMedian(5);

export const bentOverRow: ExerciseDefinition = {
  id: "bentOverRow",
  label: "Bent-Over Row",
  icon: "🚣",
  category: "Compound",
  supportedViews: ["side-left", "side-right"],
  setupTip: "Stand sideways to camera. Hinge at hips ~45°. Keep your back flat.",

  initialState(): ExerciseState {
    lElbowSmoother.reset();
    rElbowSmoother.reset();
    torsoSmoother.reset();
    return {
      phase: "READY",
      reps: 0,
      repLog: [],
      scratch: {
        minElbow: 180,
        torsoAtStart: -1,
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
    const sh    = useLeft ? landmarks[LM.LEFT_SHOULDER] : landmarks[LM.RIGHT_SHOULDER];
    const el    = useLeft ? landmarks[LM.LEFT_ELBOW]    : landmarks[LM.RIGHT_ELBOW];
    const wr    = useLeft ? landmarks[LM.LEFT_WRIST]    : landmarks[LM.RIGHT_WRIST];
    const hip   = useLeft ? landmarks[LM.LEFT_HIP]      : landmarks[LM.RIGHT_HIP];

    if (!visible([sh, el, wr, hip], 0.35)) {
      feedback.push({ id: "no-pose", severity: "warn", message: "Stand sideways — keep torso and arms visible", at: nowMs });
      return { state, feedback, repCompleted };
    }

    const vertUp   = { x: hip.x, y: hip.y - 0.2 };
    const torsoAng = torsoSmoother.push(angleDeg(sh, hip, vertUp));
    const elbowAng = (useLeft ? lElbowSmoother : rElbowSmoother).push(angleDeg(sh, el, wr));

    if (torsoAng < TORSO_BENT_MIN) {
      feedback.push({ id: "setup", severity: "warn", message: "Hinge forward ~45° before rowing", at: nowMs });
      return { state, feedback, repCompleted };
    }

    if (state.phase === "READY" && elbowAng <= ELBOW_START - HYSTERESIS) {
      state.phase = "ASCENDING";
      state.scratch.repStartAt  = nowMs;
      state.scratch.minElbow    = elbowAng;
      state.scratch.torsoAtStart = torsoAng;
    } else if (state.phase === "ASCENDING") {
      if (elbowAng < state.scratch.minElbow) state.scratch.minElbow = elbowAng;
      if (elbowAng <= ELBOW_TOP - HYSTERESIS) state.phase = "TOP";
    } else if (state.phase === "TOP") {
      if (elbowAng > ELBOW_RETURN + HYSTERESIS) state.phase = "DESCENDING";
    } else if (state.phase === "DESCENDING") {
      if (elbowAng >= ELBOW_START + HYSTERESIS) {
        state.reps += 1;
        repCompleted = true;
        state.repLog = [
          ...state.repLog,
          {
            repIndex: state.reps,
            tempoSec: Number(((nowMs - state.scratch.repStartAt) / 1000).toFixed(2)),
            metrics: { minElbowAngle: Number(state.scratch.minElbow.toFixed(1)) },
          },
        ];
        if (state.reps >= REP_TARGET) {
          feedback.push({ id: "set-complete", severity: "good", message: `Set complete — ${REP_TARGET} reps!`, at: nowMs });
        } else if (state.scratch.minElbow > ELBOW_TOP + 10) {
          feedback.push({ id: "rom", severity: "warn", message: "Pull higher for full range", at: nowMs });
        } else {
          feedback.push({ id: "rep-good", severity: "good", message: `Rep ${state.reps} — strong pull!`, at: nowMs });
        }
        state.phase = "ASCENDING";
        state.scratch.minElbow = elbowAng;
        state.scratch.torsoAtStart = torsoAng;
        state.scratch.repStartAt = nowMs;
      }
    }

    const inRep = state.phase !== "READY";
    if (inRep && state.scratch.torsoAtStart > 0 && Math.abs(torsoAng - state.scratch.torsoAtStart) > TORSO_STABLE) {
      feedback.push({ id: "torso-move", severity: "warn", message: "Don't swing — keep your torso still", at: nowMs });
    }
    if (inRep && state.scratch.torsoAtStart > 0 && torsoAng > state.scratch.torsoAtStart + BACK_ROUND_DELTA) {
      feedback.push({ id: "back-round", severity: "error", message: "Back is rounding — reset your hinge", at: nowMs });
    }

    return { state, feedback, repCompleted };
  },
};
