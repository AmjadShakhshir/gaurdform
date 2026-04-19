import { angleDeg, RollingMedian, visible } from "../lib/geometry";
import { LM, type Landmarks } from "../lib/pose";
import type { ViewAngle } from "../lib/viewAngle";
import type {
  ExerciseDefinition,
  ExerciseState,
  EvalResult,
  Feedback,
} from "./types";

const CALIBRATION_MS = 2000;
const REP_TARGET  = 10;
const HYSTERESIS  = 5;

const DESC_ELBOW = 155;
const BOTTOM_ELBOW = 95;
const ASCEND_ELBOW = 112;
const TOP_ELBOW = 160;
const WARN_DEPTH_ELBOW = 108;

const MAX_HIP_SAG_ANGLE = 160;
const MAX_PIKE_DEVIATION = 18;
const HEAD_LIFT_THRESH = 0.07;
const MIN_TEMPO_SEC = 1.2;

const elbowSmoother = new RollingMedian(5);
const bodyLineSmoother = new RollingMedian(5);

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function repQuality(
  minElbow: number,
  tempoSec: number,
  maxBodyDeviation: number,
  maxHeadLift: number,
): number {
  const depth = 100 * clamp((TOP_ELBOW - minElbow) / (TOP_ELBOW - BOTTOM_ELBOW), 0, 1);
  const alignment = 100 * clamp(1 - maxBodyDeviation / 25, 0, 1);
  const tempo = 100 * clamp(1 - Math.abs(tempoSec - 2) / 1.5, 0, 1);
  const head = 100 * clamp(1 - maxHeadLift / 0.12, 0, 1);
  return Math.round(0.40 * depth + 0.30 * alignment + 0.20 * tempo + 0.10 * head);
}

export const pushUp: ExerciseDefinition = {
  id: "pushUp",
  label: "Push-Up",
  icon: "🤸",
  category: "Upper Body",
  targetCount: REP_TARGET,
  supportedViews: ["side-left", "side-right"],
  setupTip:
    "Set the camera to your side. Keep your full body visible and hold a high-plank shape for 2 s.",

  initialState(): ExerciseState {
    elbowSmoother.reset();
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
        repStartAt: 0,
        minElbow: 180,
        maxBodyDeviation: 0,
        maxHeadLift: 0,
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

    const useLeft =
      viewAngle === "side-left" ||
      (viewAngle !== "side-right" &&
        (landmarks[LM.LEFT_SHOULDER].visibility ?? 0) >=
          (landmarks[LM.RIGHT_SHOULDER].visibility ?? 0));

    const shoulder = useLeft ? landmarks[LM.LEFT_SHOULDER] : landmarks[LM.RIGHT_SHOULDER];
    const elbow = useLeft ? landmarks[LM.LEFT_ELBOW] : landmarks[LM.RIGHT_ELBOW];
    const wrist = useLeft ? landmarks[LM.LEFT_WRIST] : landmarks[LM.RIGHT_WRIST];
    const hip = useLeft ? landmarks[LM.LEFT_HIP] : landmarks[LM.RIGHT_HIP];
    const ankle = useLeft ? landmarks[LM.LEFT_ANKLE] : landmarks[LM.RIGHT_ANKLE];
    const nose = landmarks[LM.NOSE];

    if (!visible([shoulder, elbow, wrist, hip, ankle], 0.4)) {
      feedback.push({
        id: "no-pose",
        severity: "warn",
        message: "Keep your side profile fully visible",
        at: nowMs,
      });
      return { state, feedback, repCompleted };
    }

    const elbowAngle = elbowSmoother.push(angleDeg(shoulder, elbow, wrist));
    const bodyLine = bodyLineSmoother.push(angleDeg(shoulder, hip, ankle));
    const bodyDeviation = Number.isNaN(bodyLine) ? 0 : Math.abs(180 - bodyLine);
    const headLift = Math.max(0, shoulder.y - nose.y);

    if (state.phase === "CALIBRATING") {
      if (state.scratch.calibStartAt < 0) state.scratch.calibStartAt = nowMs;
      const elapsed = nowMs - state.scratch.calibStartAt;
      if (!Number.isNaN(bodyLine)) {
        state.scratch.calibBodyLineSum += bodyLine;
        state.scratch.calibFrames += 1;
      }
      if (elapsed < CALIBRATION_MS) {
        const rem = Math.ceil((CALIBRATION_MS - elapsed) / 1000);
        feedback.push({
          id: "calibrating",
          severity: "warn",
          message: `Hold high plank — calibrating ${rem}s`,
          at: nowMs,
        });
        return { state, feedback, repCompleted };
      }
      state.scratch.baselineBodyLine =
        state.scratch.calibBodyLineSum / Math.max(1, state.scratch.calibFrames);
      state.phase = "READY";
    }

    if (state.phase === "READY" && elbowAngle < DESC_ELBOW - HYSTERESIS) {
      state.phase = "DESCENDING";
      state.scratch.repStartAt = nowMs;
      state.scratch.minElbow = elbowAngle;
      state.scratch.maxBodyDeviation = bodyDeviation;
      state.scratch.maxHeadLift = headLift;
    } else if (state.phase === "DESCENDING") {
      if (elbowAngle < state.scratch.minElbow) state.scratch.minElbow = elbowAngle;
      if (bodyDeviation > state.scratch.maxBodyDeviation) {
        state.scratch.maxBodyDeviation = bodyDeviation;
      }
      if (headLift > state.scratch.maxHeadLift) state.scratch.maxHeadLift = headLift;
      if (elbowAngle <= BOTTOM_ELBOW - HYSTERESIS) state.phase = "BOTTOM";
    } else if (state.phase === "BOTTOM") {
      if (elbowAngle < state.scratch.minElbow) state.scratch.minElbow = elbowAngle;
      if (bodyDeviation > state.scratch.maxBodyDeviation) {
        state.scratch.maxBodyDeviation = bodyDeviation;
      }
      if (headLift > state.scratch.maxHeadLift) state.scratch.maxHeadLift = headLift;
      if (elbowAngle > ASCEND_ELBOW + HYSTERESIS) state.phase = "ASCENDING";
    } else if (state.phase === "ASCENDING") {
      if (bodyDeviation > state.scratch.maxBodyDeviation) {
        state.scratch.maxBodyDeviation = bodyDeviation;
      }
      if (headLift > state.scratch.maxHeadLift) state.scratch.maxHeadLift = headLift;

      if (elbowAngle >= TOP_ELBOW + HYSTERESIS) {
        state.reps += 1;
        repCompleted = true;

        const tempoSec = Number(((nowMs - state.scratch.repStartAt) / 1000).toFixed(2));
        const score = repQuality(
          state.scratch.minElbow,
          tempoSec,
          state.scratch.maxBodyDeviation,
          state.scratch.maxHeadLift,
        );

        state.repLog = [
          ...state.repLog,
          {
            repIndex: state.reps,
            tempoSec,
            metrics: {
              minElbowAngle: Math.round(state.scratch.minElbow),
              maxBodyDeviation: Number(state.scratch.maxBodyDeviation.toFixed(1)),
              maxHeadLift: Number(state.scratch.maxHeadLift.toFixed(3)),
              score,
            },
          },
        ];

        if (state.reps >= REP_TARGET) {
          feedback.push({
            id: "set-complete",
            severity: "good",
            message: `Set complete — ${REP_TARGET} reps!`,
            at: nowMs,
          });
        } else if (state.scratch.minElbow > WARN_DEPTH_ELBOW) {
          feedback.push({
            id: "depth",
            severity: "warn",
            message: "Go lower — chest toward the floor",
            at: nowMs,
          });
        } else if (tempoSec < MIN_TEMPO_SEC) {
          feedback.push({
            id: "tempo",
            severity: "warn",
            message: "Slow down and control each rep",
            at: nowMs,
          });
        } else {
          feedback.push({
            id: "rep-good",
            severity: "good",
            message: `Rep ${state.reps} — ${score}/100`,
            at: nowMs,
          });
        }

        state.phase = "READY";
      }
    }

    const inRep = state.phase !== "READY";
    if (inRep) {
      if (bodyLine < MAX_HIP_SAG_ANGLE) {
        feedback.push({
          id: "hip-sag",
          severity: "error",
          message: "Keep hips up — brace your core",
          at: nowMs,
        });
      } else if (bodyLine > 180 + MAX_PIKE_DEVIATION) {
        feedback.push({
          id: "hip-pike",
          severity: "warn",
          message: "Lower your hips — keep a straight line",
          at: nowMs,
        });
      }

      if (headLift > HEAD_LIFT_THRESH) {
        feedback.push({
          id: "head-neutral",
          severity: "warn",
          message: "Keep head neutral — look down",
          at: nowMs,
        });
      }
    }

    return { state, feedback, repCompleted };
  },
};