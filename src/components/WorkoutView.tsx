import { useState } from "react";
import { CheckCircle2, Circle, Play, Trophy, LayoutList, Navigation } from "lucide-react";
import type { TrainingPlan, WorkoutDay } from "../lib/trainingPlan";
import type { ExerciseId } from "../exercises/types";
import { EXERCISES } from "../exercises/index";

interface Props {
  plan: TrainingPlan;
  todayWorkout: WorkoutDay;
  todayDayIndex: number;
  completedSets: Record<string, number>;
  currentExerciseIdx: number;
  isWorkoutComplete: boolean;
  onStartExercise: (exerciseId: ExerciseId) => void;
  onCompleteWorkout: () => void;
}

type ViewMode = "guided" | "checklist";

function getExercise(id: ExerciseId) {
  return EXERCISES.find((e) => e.id === id)!;
}

export function WorkoutView({
  plan,
  todayWorkout,
  todayDayIndex,
  completedSets,
  currentExerciseIdx,
  isWorkoutComplete,
  onStartExercise,
  onCompleteWorkout,
}: Props) {
  const [mode, setMode] = useState<ViewMode>("guided");

  const totalSets = todayWorkout.exercises.reduce((sum, ex) => sum + ex.sets, 0);
  const doneSets = todayWorkout.exercises.reduce(
    (sum, ex) => sum + Math.min(completedSets[ex.exerciseId] ?? 0, ex.sets),
    0,
  );
  const progressPct = totalSets > 0 ? (doneSets / totalSets) * 100 : 0;

  const goalLabel =
    plan.profile.goal === "strength"
      ? "Strength"
      : plan.profile.goal === "hypertrophy"
        ? "Muscle"
        : plan.profile.goal === "endurance"
          ? "Endurance"
          : "General Fit";

  if (isWorkoutComplete) {
    return (
      <div className="flex flex-col items-center justify-center gap-5 py-10 px-4 text-center animate-scale-in">
        <div className="w-20 h-20 rounded-full bg-gradient-accent flex items-center justify-center shadow-glow-accent">
          <Trophy size={36} className="text-brand-bg" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Workout Complete!</h2>
          <p className="text-sm text-white/50 mt-1">
            {todayWorkout.focus} · {doneSets} sets done
          </p>
        </div>
        <button
          onClick={onCompleteWorkout}
          className="px-8 py-3.5 rounded-2xl bg-gradient-accent text-brand-bg font-bold shadow-glow-accent transition-smooth active:scale-95"
        >
          Finish &amp; save progress
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 px-1 pb-4 animate-fade-in">
      {/* Day header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-brand-accent font-bold uppercase tracking-widest">
            {todayWorkout.dayLabel} of {plan.days.length} — {goalLabel}
          </p>
          <h2 className="text-lg font-bold text-white mt-0.5">{todayWorkout.focus}</h2>
        </div>
        <span className="text-xs text-white/40 font-medium">
          Day {todayDayIndex + 1}
        </span>
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-white/40">Sets done</span>
          <span className="text-xs font-semibold text-white/60">
            {doneSets}/{totalSets}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-accent transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Mode toggle */}
      <div className="flex rounded-xl bg-white/5 p-1 gap-1">
        {(["guided", "checklist"] as ViewMode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-smooth ${
              mode === m
                ? "bg-brand-accent text-brand-bg shadow-glow-accent-sm"
                : "text-white/50 hover:text-white"
            }`}
          >
            {m === "guided" ? (
              <Navigation size={13} />
            ) : (
              <LayoutList size={13} />
            )}
            {m.charAt(0).toUpperCase() + m.slice(1)}
          </button>
        ))}
      </div>

      {/* Exercise list */}
      <div className="flex flex-col gap-2">
        {todayWorkout.exercises.map((planned, idx) => {
          const exDef = getExercise(planned.exerciseId);
          const done = completedSets[planned.exerciseId] ?? 0;
          const allDone = done >= planned.sets;
          const isCurrentGuided = mode === "guided" && idx === currentExerciseIdx;
          const canStart =
            mode === "checklist" ? !allDone : isCurrentGuided;

          const repsLabel =
            planned.exerciseId === "plank"
              ? `${planned.reps}s hold`
              : `${planned.reps} reps`;

          return (
            <div
              key={planned.exerciseId}
              className={`glass-card rounded-2xl p-3.5 flex items-center gap-3 transition-smooth ${
                allDone ? "opacity-50" : ""
              } ${isCurrentGuided ? "border-brand-accent/40 shadow-glow-accent" : ""}`}
            >
              {/* Completion indicator */}
              <div className="shrink-0">
                {allDone ? (
                  <CheckCircle2 size={22} className="text-brand-accent" />
                ) : (
                  <Circle
                    size={22}
                    className={isCurrentGuided ? "text-brand-accent" : "text-white/20"}
                  />
                )}
              </div>

              {/* Exercise info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-base">{exDef.icon ?? "🏋️"}</span>
                  <span
                    className={`text-sm font-semibold truncate ${
                      allDone ? "line-through text-white/30" : "text-white"
                    }`}
                  >
                    {exDef.label}
                  </span>
                </div>
                <p className="text-xs text-white/40 mt-0.5">
                  {planned.sets} sets · {repsLabel} · {planned.restSec}s rest
                </p>
                {/* Set progress dots */}
                {!allDone && (
                  <div className="flex gap-1 mt-1.5">
                    {Array.from({ length: planned.sets }).map((_, si) => (
                      <div
                        key={si}
                        className={`w-2 h-2 rounded-full transition-smooth ${
                          si < done ? "bg-brand-accent" : "bg-white/15"
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Start button */}
              {canStart && (
                <button
                  onClick={() => onStartExercise(planned.exerciseId)}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-accent text-brand-bg font-bold text-xs shadow-glow-accent-sm transition-smooth active:scale-95"
                >
                  <Play size={12} />
                  Start
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Guided tip */}
      {mode === "guided" && (
        <p className="text-xs text-white/30 text-center px-2">
          Complete each set, then tap Stop. The coach auto-advances to the next exercise.
        </p>
      )}
    </div>
  );
}
