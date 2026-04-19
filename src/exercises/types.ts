import type { Landmarks } from "../lib/pose";
import type { ViewAngle } from "../lib/viewAngle";

export type Phase =
  | "CALIBRATING"
  | "READY"
  | "DESCENDING"
  | "BOTTOM"
  | "TOP"
  | "ASCENDING"
  | "HOLDING";
export type Severity = "good" | "warn" | "error" | "critical";

export type ExerciseId =
  | "squat"
  | "pushUp"
  | "plank"
  | "bicepCurl"
  | "lunge"
  | "rdl"
  | "bulgarianSplitSquat"
  | "legPress"
  | "calfRaise"
  | "overheadPress"
  | "deadlift"
  | "bentOverRow";

export type ExerciseCategory = "Legs" | "Upper Body" | "Compound";

export interface Feedback {
  id: string;
  severity: Severity;
  message: string;
  /** Performance.now() timestamp when created. */
  at: number;
}

export interface ExerciseState {
  phase: Phase;
  reps: number;
  /** Per-rep summary stats — flushed at end of each rep. */
  repLog: RepSummary[];
  /** Scratch space — an exercise may store intra-rep mins/maxes. */
  scratch: Record<string, number>;
}

export interface RepSummary {
  repIndex: number;
  tempoSec: number;
  /** Key metrics per exercise, e.g. {minKneeAngle: 98, backLean: 42, symmetry: 8} */
  metrics: Record<string, number>;
}

export interface EvalResult {
  state: ExerciseState;
  feedback: Feedback[];
  repCompleted: boolean;
}

export interface ExerciseDefinition {
  id: ExerciseId;
  label: string;
  /** Emoji icon shown in the compact mobile exercise selector. */
  icon?: string;
  category: ExerciseCategory;
  /** Counter target shown in UI ring (defaults to 10). */
  targetCount?: number;
  /** Counter unit label shown in UI ring (defaults to reps). */
  counterUnit?: "reps" | "s";
  /** Recommended camera angles. FormGuard will warn if another angle is detected. */
  supportedViews: ViewAngle[];
  /** One-liner shown to user while setting up. */
  setupTip: string;
  /** Minimum rep duration in ms. Reps completed faster will get a tempo warning. */
  minRepDurationMs?: number;
  /** Initial state factory. */
  initialState(): ExerciseState;
  /**
   * Pure-ish: given landmarks + previous state + detected view angle,
   * returns new state and feedback for this frame.
   */
  evaluate(
    landmarks: Landmarks,
    state: ExerciseState,
    nowMs: number,
    viewAngle: ViewAngle
  ): EvalResult;
}
