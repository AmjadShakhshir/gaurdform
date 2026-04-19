import { angleDeg, dist, RollingMedian, visible } from "../lib/geometry";
import { LM, type Landmarks } from "../lib/pose";
import type { ViewAngle } from "../lib/viewAngle";
import type {
  ExerciseDefinition,
  ExerciseState,
  EvalResult,
  Feedback,
} from "./types";

// ── Thresholds ────────────────────────────────────────────────────────────────
const DESC_KNEE       = 155; // below → descending
const BOTTOM_KNEE     = 110; // below → at bottom
const ASCEND_KNEE     = 130; // above (from bottom) → ascending
const TOP_KNEE        = 165; // above → rep complete

const WARN_DEPTH_KNEE    = 115; // above this at bottom → "go deeper"

// Front / back view
const MAX_BACK_LEAN_DEG    = 55;   // shoulder-hip vector vs vertical
const MIN_KNEE_WIDTH_RATIO = 0.70; // knee width / ankle width (cave detection)
const SYMMETRY_DELTA       = 20;   // |L - R| knee angle at bottom
const STANCE_MIN_RATIO     = 0.75; // ankle/hip span too narrow
const STANCE_MAX_RATIO     = 1.60; // ankle/hip span too wide

// Side view
const MAX_TORSO_LEAN   = 48;    // degrees from vertical
const BUTT_WINK_DELTA  = 15;    // degrees extra back angle vs start of descent
const HEEL_RISE_THRESH = 0.025; // normalised Y drop from standing baseline
const BAR_PATH_THRESH  = 0.055; // normalised X wrist deviation from baseline

const REP_TARGET     = 10;
const CALIBRATION_MS = 2500;
const HYSTERESIS     = 5;

// ── Module-level smoothers ────────────────────────────────────────────────────
const leftKneeSmoother  = new RollingMedian(5);
const rightKneeSmoother = new RollingMedian(5);
const backLeanSmoother  = new RollingMedian(5);

// ── Helpers ───────────────────────────────────────────────────────────────────
function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function repQuality(
  minKnee: number,
  maxBackLean: number,
  symmetryDelta: number,
  heelRose: boolean,
  buttWink: boolean,
): number {
  const depth = 100 * clamp((165 - minKnee) / (165 - 90), 0, 1);  // 40 %
  const lean  = 100 * clamp(1 - maxBackLean / 65, 0, 1);           // 25 %
  const sym   = 100 * clamp(1 - symmetryDelta / 30, 0, 1);         // 20 %
  const heel  = heelRose ? 60 : 100;                                // 10 %
  const wink  = buttWink ? 70 : 100;                                //  5 %
  return Math.round(
    0.40 * depth + 0.25 * lean + 0.20 * sym + 0.10 * heel + 0.05 * wink,
  );
}

// ── Exercise definition ────────────────────────────────────────────────────────────────
export const squat: ExerciseDefinition = {
  id: "squat",
  label: "Squat",
  icon: "🦵",
  category: "Legs",
  supportedViews: ["front", "side-left", "side-right", "back"],
  setupTip:
    "Stand ~2 m from camera. Face it for knee-valgus feedback, or stand sideways for depth & heel-rise checks. Full body must be in frame.",

  initialState(): ExerciseState {
    leftKneeSmoother.reset();
    rightKneeSmoother.reset();
    backLeanSmoother.reset();
    return {
      phase: "CALIBRATING",
      reps: 0,
      repLog: [],
      scratch: {
        calibStartAt: -1, calibFrames: 0,
        calibAnkleYLSum: 0, calibAnkleYRSum: 0, calibWristMidXSum: 0,
        baselineAnkleYL: -1, baselineAnkleYR: -1, baselineWristMidX: -1,
        stanceRatio: 0,
        minKnee: 180, maxBackLean: 0, repStartAt: 0,
        lastBottomSymmetry: 0, lastBottomHipDiff: 0,
        heelRose: 0, buttWink: 0, maxBarPathDev: 0,
        backAngleAtDescentStart: 0,
        stanceWarned: 0,
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

    const lHip   = landmarks[LM.LEFT_HIP];
    const rHip   = landmarks[LM.RIGHT_HIP];
    const lKnee  = landmarks[LM.LEFT_KNEE];
    const rKnee  = landmarks[LM.RIGHT_KNEE];
    const lAnkle = landmarks[LM.LEFT_ANKLE];
    const rAnkle = landmarks[LM.RIGHT_ANKLE];
    const lSh    = landmarks[LM.LEFT_SHOULDER];
    const rSh    = landmarks[LM.RIGHT_SHOULDER];
    const lWrist = landmarks[LM.LEFT_WRIST];
    const rWrist = landmarks[LM.RIGHT_WRIST];

    const isSide  = viewAngle === "side-left" || viewAngle === "side-right";
    const useLeft = (lKnee.visibility ?? 0) >= (rKnee.visibility ?? 0);
    const visHip   = useLeft ? lHip   : rHip;
    const visKnee  = useLeft ? lKnee  : rKnee;
    const visAnkle = useLeft ? lAnkle : rAnkle;

    const frontOk = visible([lHip, rHip, lKnee, rKnee, lAnkle, rAnkle], 0.35);
    const sideOk  = visible([visHip, visKnee, visAnkle], 0.40);
    if (!frontOk && !sideOk) {
      feedback.push({ id: "no-pose", severity: "warn", message: "Keep full body in frame", at: nowMs });
      return { state, feedback, repCompleted };
    }

    // ── CALIBRATING ────────────────────────────────────────────────────────────────
    if (state.phase === "CALIBRATING") {
      if (state.scratch.calibStartAt < 0) state.scratch.calibStartAt = nowMs;
      const elapsed = nowMs - state.scratch.calibStartAt;
      state.scratch.calibAnkleYLSum   += lAnkle.y;
      state.scratch.calibAnkleYRSum   += rAnkle.y;
      state.scratch.calibWristMidXSum += (lWrist.x + rWrist.x) / 2;
      state.scratch.calibFrames       += 1;
      if (elapsed < CALIBRATION_MS) {
        const rem = Math.ceil((CALIBRATION_MS - elapsed) / 1000);
        feedback.push({ id: "calibrating", severity: "warn", message: `Hold still — calibrating ${rem}s`, at: nowMs });
        return { state, feedback, repCompleted };
      }
      const n = Math.max(1, state.scratch.calibFrames);
      state.scratch.baselineAnkleYL   = state.scratch.calibAnkleYLSum   / n;
      state.scratch.baselineAnkleYR   = state.scratch.calibAnkleYRSum   / n;
      state.scratch.baselineWristMidX = state.scratch.calibWristMidXSum / n;
      const ankleW = dist(lAnkle, rAnkle);
      const hipW   = dist(lHip, rHip);
      state.scratch.stanceRatio = hipW > 0.02 ? ankleW / hipW : 1.0;
      state.phase = "READY";
    }

    // ── Angle computation ───────────────────────────────────────────────────────────────
    let lKneeAng: number;
    let rKneeAng: number;
    let kneeAng: number;
    if (isSide) {
      const raw = angleDeg(visHip, visKnee, visAnkle);
      lKneeAng = leftKneeSmoother.push(raw);
      rKneeAng = rightKneeSmoother.push(raw);
      kneeAng  = useLeft ? lKneeAng : rKneeAng;
    } else {
      lKneeAng = leftKneeSmoother.push(angleDeg(lHip, lKnee, lAnkle));
      rKneeAng = rightKneeSmoother.push(angleDeg(rHip, rKnee, rAnkle));
      kneeAng  = (lKneeAng + rKneeAng) / 2;
    }
    const shMid  = { x: (lSh.x + rSh.x) / 2, y: (lSh.y + rSh.y) / 2 };
    const hpMid  = { x: (lHip.x + rHip.x) / 2, y: (lHip.y + rHip.y) / 2 };
    const vertUp = { x: hpMid.x, y: hpMid.y - 0.2 };
    const backLean = backLeanSmoother.push(angleDeg(shMid, hpMid, vertUp));

    // ── Phase state machine ───────────────────────────────────────────────────────────────
    if (state.phase === "READY" && kneeAng < DESC_KNEE - HYSTERESIS) {
      state.phase = "DESCENDING";
      state.scratch.repStartAt              = nowMs;
      state.scratch.minKnee                 = kneeAng;
      state.scratch.maxBackLean             = backLean;
      state.scratch.heelRose                = 0;
      state.scratch.buttWink                = 0;
      state.scratch.maxBarPathDev           = 0;
      state.scratch.backAngleAtDescentStart = backLean;
    } else if (state.phase === "DESCENDING") {
      if (kneeAng < state.scratch.minKnee)   state.scratch.minKnee     = kneeAng;
      if (backLean > state.scratch.maxBackLean) state.scratch.maxBackLean = backLean;
      if (kneeAng < BOTTOM_KNEE - HYSTERESIS) {
        state.phase = "BOTTOM";
        state.scratch.lastBottomSymmetry = Math.abs(lKneeAng - rKneeAng);
        state.scratch.lastBottomHipDiff  = Math.abs(lHip.y - rHip.y);
      }
    } else if (state.phase === "BOTTOM") {
      if (kneeAng < state.scratch.minKnee)   state.scratch.minKnee     = kneeAng;
      if (backLean > state.scratch.maxBackLean) state.scratch.maxBackLean = backLean;
      if (backLean - state.scratch.backAngleAtDescentStart > BUTT_WINK_DELTA) {
        state.scratch.buttWink = 1;
      }
      if (kneeAng > ASCEND_KNEE + HYSTERESIS) state.phase = "ASCENDING";
    } else if (state.phase === "ASCENDING") {
      if (kneeAng > TOP_KNEE + HYSTERESIS) {
        state.reps += 1;
        repCompleted = true;
        const heelRose = state.scratch.heelRose > HEEL_RISE_THRESH;
        const buttWink = state.scratch.buttWink > 0;
        const score = repQuality(
          state.scratch.minKnee, state.scratch.maxBackLean,
          state.scratch.lastBottomSymmetry, heelRose, buttWink,
        );
        state.repLog = [
          ...state.repLog,
          {
            repIndex: state.reps,
            tempoSec: Number(((nowMs - state.scratch.repStartAt) / 1000).toFixed(2)),
            metrics: {
              minKneeAngle:     Number(state.scratch.minKnee.toFixed(1)),
              maxBackLean:      Number(state.scratch.maxBackLean.toFixed(1)),
              symmetryDelta:    Number(state.scratch.lastBottomSymmetry.toFixed(1)),
              heelRise:         heelRose ? 1 : 0,
              buttWink:         buttWink ? 1 : 0,
              barPathDeviation: Number(state.scratch.maxBarPathDev.toFixed(3)),
              score,
            },
          },
        ];
        if (state.reps >= REP_TARGET) {
          feedback.push({ id: "set-complete", severity: "good", message: `Set complete — ${REP_TARGET} reps! Great work!`, at: nowMs });
        } else if (state.scratch.minKnee > WARN_DEPTH_KNEE) {
          feedback.push({ id: "depth", severity: "warn", message: "Go deeper next rep", at: nowMs });
        } else {
          feedback.push({ id: "rep-good", severity: "good", message: `Rep ${state.reps} — depth ${Math.round(state.scratch.minKnee)}° · ${score}/100`, at: nowMs });
        }
        state.phase = "READY";
        state.scratch.minKnee = 180; state.scratch.maxBackLean = 0;
        state.scratch.heelRose = 0;  state.scratch.buttWink = 0;
        state.scratch.maxBarPathDev = 0;
      }
    }

    // ── Live form rules ────────────────────────────────────────────────────────────────
    const inRep = state.phase === "DESCENDING" || state.phase === "BOTTOM" || state.phase === "ASCENDING";

    if (!isSide) {
      // Knee valgus
      const kneeW  = dist(lKnee, rKnee);
      const ankleW = dist(lAnkle, rAnkle);
      if (ankleW > 0.02 && kneeW / ankleW < MIN_KNEE_WIDTH_RATIO && inRep) {
        feedback.push({ id: "knee-cave", severity: "error", message: "Push your knees out!", at: nowMs });
      }
      // Symmetry at bottom
      if (state.phase === "BOTTOM" && Math.abs(lKneeAng - rKneeAng) > SYMMETRY_DELTA) {
        feedback.push({ id: "symmetry", severity: "warn", message: "Balance weight evenly", at: nowMs });
      }
      // Back lean
      if (backLean > MAX_BACK_LEAN_DEG && inRep) {
        feedback.push({ id: "chest-up", severity: "warn", message: "Chest up — brace your core", at: nowMs });
      }
      // Stance width (once per session)
      if (state.phase === "READY" && state.scratch.stanceWarned === 0 && state.scratch.stanceRatio > 0) {
        state.scratch.stanceWarned = 1;
        if (state.scratch.stanceRatio < STANCE_MIN_RATIO) {
          feedback.push({ id: "stance-narrow", severity: "warn", message: "Widen your stance", at: nowMs });
        } else if (state.scratch.stanceRatio > STANCE_MAX_RATIO) {
          feedback.push({ id: "stance-wide", severity: "warn", message: "Narrow your stance slightly", at: nowMs });
        }
      }
      // Weight shift (back view)
      if (viewAngle === "back" && state.phase === "BOTTOM" && Math.abs(lHip.y - rHip.y) > 0.03) {
        feedback.push({ id: "weight-shift", severity: "warn", message: "Even out your weight", at: nowMs });
      }
    } else {
      // Forward lean
      if (backLean > MAX_TORSO_LEAN && inRep) {
        feedback.push({ id: "forward-lean", severity: "warn", message: "Chest up — too much forward lean", at: nowMs });
      }
      // Butt wink
      if (state.phase === "BOTTOM" && state.scratch.buttWink > 0) {
        feedback.push({ id: "butt-wink", severity: "warn", message: "Don't tuck the pelvis at the bottom", at: nowMs });
      }
      // Heel rise
      if (state.scratch.baselineAnkleYL > 0 && inRep) {
        const riseL   = state.scratch.baselineAnkleYL - lAnkle.y;
        const riseR   = state.scratch.baselineAnkleYR - rAnkle.y;
        const maxRise = Math.max(riseL, riseR);
        if (maxRise > state.scratch.heelRose) state.scratch.heelRose = maxRise;
        if (maxRise > HEEL_RISE_THRESH) {
          feedback.push({ id: "heel-rise", severity: "error", message: "Keep heels flat on the ground!", at: nowMs });
        }
      }
      // Bar path (wrist midpoint)
      if (state.scratch.baselineWristMidX > 0 && inRep && visible([lWrist, rWrist], 0.25)) {
        const wristMidX = (lWrist.x + rWrist.x) / 2;
        const dev = Math.abs(wristMidX - state.scratch.baselineWristMidX);
        if (dev > state.scratch.maxBarPathDev) state.scratch.maxBarPathDev = dev;
        if (dev > BAR_PATH_THRESH) {
          feedback.push({ id: "bar-path", severity: "warn", message: "Keep bar over mid-foot", at: nowMs });
        }
      }
      // Depth from hip crease
      if ((state.phase === "BOTTOM" || state.phase === "ASCENDING") && state.scratch.minKnee > WARN_DEPTH_KNEE) {
        if (visHip.y < visKnee.y - 0.03) {
          feedback.push({ id: "depth-side", severity: "warn", message: "Squat lower — hit parallel", at: nowMs });
        }
      }
    }

    return { state, feedback, repCompleted };
  },
};

