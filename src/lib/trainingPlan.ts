import type { ExerciseId } from "../exercises/types";

export type TrainingGoal = "strength" | "hypertrophy" | "endurance" | "general";
export type ExperienceLevel = "beginner" | "intermediate" | "advanced";

export interface TraineeProfile {
  goal: TrainingGoal;
  experience: ExperienceLevel;
  createdAt: string;
}

export interface PlannedExercise {
  exerciseId: ExerciseId;
  sets: number;
  /** For time-based exercises (plank), this represents seconds. For others, reps. */
  reps: number;
  restSec: number;
}

export interface WorkoutDay {
  dayLabel: string;
  focus: string;
  exercises: PlannedExercise[];
}

export interface TrainingPlan {
  id: string;
  profile: TraineeProfile;
  days: WorkoutDay[];
  createdAt: string;
  active: boolean;
  /** How many workouts have been completed across all days (used for day rotation). */
  completedWorkoutCount: number;
  /** ISO date string (YYYY-MM-DD) of the last completed workout, prevents double-counting. */
  lastWorkoutDate: string | null;
}
