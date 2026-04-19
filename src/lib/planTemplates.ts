import type { ExerciseId } from "../exercises/types";
import type {
  TraineeProfile,
  TrainingGoal,
  ExperienceLevel,
  PlannedExercise,
  WorkoutDay,
  TrainingPlan,
} from "./trainingPlan";

interface GoalParams {
  sets: number;
  reps: number;
  restSec: number;
}

const GOAL_PARAMS: Record<TrainingGoal, GoalParams> = {
  strength:    { sets: 5, reps: 5,  restSec: 90 },
  hypertrophy: { sets: 4, reps: 10, restSec: 60 },
  endurance:   { sets: 3, reps: 15, restSec: 30 },
  general:     { sets: 3, reps: 12, restSec: 45 },
};

const PLANK_SECS: Record<ExperienceLevel, number> = {
  beginner:     30,
  intermediate: 45,
  advanced:     60,
};

function adjustSets(baseSets: number, experience: ExperienceLevel): number {
  if (experience === "beginner") return Math.max(2, baseSets - 1);
  if (experience === "advanced") return Math.min(baseSets + 1, 6);
  return baseSets;
}

function makePlanned(
  exerciseId: ExerciseId,
  goal: TrainingGoal,
  experience: ExperienceLevel,
): PlannedExercise {
  const base = GOAL_PARAMS[goal];
  const sets = adjustSets(base.sets, experience);
  const reps = exerciseId === "plank" ? PLANK_SECS[experience] : base.reps;
  return { exerciseId, sets, reps, restSec: base.restSec };
}

type DayTemplate = { label: string; focus: string; exercises: ExerciseId[] };

const BEGINNER_DAYS: DayTemplate[] = [
  { label: "Day 1", focus: "Full Body A",  exercises: ["squat", "pushUp", "bicepCurl"] },
  { label: "Day 2", focus: "Full Body B",  exercises: ["lunge", "plank", "calfRaise"] },
  { label: "Day 3", focus: "Full Body C",  exercises: ["squat", "pushUp", "lunge"] },
];

const INTERMEDIATE_DAYS: DayTemplate[] = [
  { label: "Day 1", focus: "Lower Body",       exercises: ["squat", "lunge", "calfRaise"] },
  { label: "Day 2", focus: "Upper Push",        exercises: ["pushUp", "overheadPress", "plank"] },
  { label: "Day 3", focus: "Posterior Chain",   exercises: ["rdl", "legPress", "calfRaise"] },
  { label: "Day 4", focus: "Upper Pull",        exercises: ["bentOverRow", "bicepCurl", "plank"] },
];

const ADVANCED_DAYS: DayTemplate[] = [
  { label: "Day 1", focus: "Legs",            exercises: ["squat", "lunge", "bulgarianSplitSquat", "calfRaise"] },
  { label: "Day 2", focus: "Push",            exercises: ["pushUp", "overheadPress", "plank"] },
  { label: "Day 3", focus: "Pull",            exercises: ["deadlift", "bentOverRow", "bicepCurl"] },
  { label: "Day 4", focus: "Posterior Chain", exercises: ["rdl", "legPress", "calfRaise"] },
  { label: "Day 5", focus: "Full Upper",      exercises: ["pushUp", "overheadPress", "bentOverRow", "bicepCurl"] },
];

const DAY_TEMPLATES: Record<ExperienceLevel, DayTemplate[]> = {
  beginner:     BEGINNER_DAYS,
  intermediate: INTERMEDIATE_DAYS,
  advanced:     ADVANCED_DAYS,
};

export function generatePlan(profile: TraineeProfile): TrainingPlan {
  const templates = DAY_TEMPLATES[profile.experience];
  const days: WorkoutDay[] = templates.map((t) => ({
    dayLabel: t.label,
    focus: t.focus,
    exercises: t.exercises.map((id) => makePlanned(id, profile.goal, profile.experience)),
  }));

  return {
    id: crypto.randomUUID(),
    profile,
    days,
    createdAt: new Date().toISOString(),
    active: true,
    completedWorkoutCount: 0,
    lastWorkoutDate: null,
  };
}
