import { useState } from "react";
import { ChevronLeft, ChevronRight, Check, Calendar } from "lucide-react";
import type { TrainingGoal, ExperienceLevel, TraineeProfile, TrainingPlan } from "../lib/trainingPlan";
import { generatePlan } from "../lib/planTemplates";
import { EXERCISES } from "../exercises/index";

interface Props {
  onConfirm: (profile: TraineeProfile, plan: TrainingPlan) => void;
}

const GOALS: {
  id: TrainingGoal;
  label: string;
  desc: string;
  icon: string;
  detail: string;
}[] = [
  {
    id: "strength",
    label: "Strength",
    icon: "🏋️",
    desc: "Lift heavy, get strong",
    detail: "Low reps · Heavy weight · Long rest",
  },
  {
    id: "hypertrophy",
    label: "Muscle",
    icon: "💪",
    desc: "Build size and shape",
    detail: "Moderate reps · Pump focus · Structured rest",
  },
  {
    id: "endurance",
    label: "Endurance",
    icon: "🏃",
    desc: "Train longer, stronger",
    detail: "High reps · Short rest · Conditioning",
  },
  {
    id: "general",
    label: "General Fit",
    icon: "⚡",
    desc: "Balanced overall health",
    detail: "All-around · Great for beginners",
  },
];

const LEVELS: {
  id: ExperienceLevel;
  label: string;
  icon: string;
  desc: string;
  daysPerWeek: number;
}[] = [
  {
    id: "beginner",
    label: "Beginner",
    icon: "🌱",
    desc: "Less than 1 year of consistent training",
    daysPerWeek: 3,
  },
  {
    id: "intermediate",
    label: "Intermediate",
    icon: "🔥",
    desc: "1–3 years of regular gym experience",
    daysPerWeek: 4,
  },
  {
    id: "advanced",
    label: "Advanced",
    icon: "⚔️",
    desc: "3+ years, comfortable with compound lifts",
    daysPerWeek: 5,
  },
];

export function PlanBuilder({ onConfirm }: Props) {
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState<TrainingGoal | null>(null);
  const [experience, setExperience] = useState<ExperienceLevel | null>(null);
  const [preview, setPreview] = useState<TrainingPlan | null>(null);

  function handleGoalSelect(g: TrainingGoal) {
    setGoal(g);
    setStep(1);
  }

  function handleLevelSelect(e: ExperienceLevel) {
    setExperience(e);
    const profile: TraineeProfile = {
      goal: goal!,
      experience: e,
      createdAt: new Date().toISOString(),
    };
    setPreview(generatePlan(profile));
    setStep(2);
  }

  function handleConfirm() {
    if (!preview) return;
    onConfirm(preview.profile, preview);
  }

  function getExerciseLabel(id: string) {
    return EXERCISES.find((e) => e.id === id)?.label ?? id;
  }

  function getExerciseIcon(id: string) {
    return EXERCISES.find((e) => e.id === id)?.icon ?? "🏋️";
  }

  const selectedGoal = GOALS.find((g) => g.id === goal);

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col">
      {/* Header */}
      <div className="glass-dark border-b border-white/5 px-4 py-4 flex items-center gap-3 pt-safe-top">
        {step > 0 && (
          <button
            onClick={() => setStep((s) => s - 1)}
            className="w-9 h-9 flex items-center justify-center rounded-full glass-card text-white/60 hover:text-white transition-smooth"
          >
            <ChevronLeft size={18} />
          </button>
        )}
        <div className="flex-1">
          <p className="text-xs text-white/40 uppercase tracking-widest font-semibold">
            Step {step + 1} of 3
          </p>
          <div className="mt-1.5 h-1 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-accent transition-all duration-500"
              style={{ width: `${((step + 1) / 3) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Step 0 — Goal */}
      {step === 0 && (
        <div className="flex-1 flex flex-col px-4 py-6 gap-4 animate-slide-up max-w-lg mx-auto w-full">
          <div className="mb-2">
            <h1 className="text-2xl font-bold text-white">
              What's your fitness <span className="text-gradient-brand">goal?</span>
            </h1>
            <p className="text-sm text-white/50 mt-1">
              We'll build a personalised weekly plan around your objective.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {GOALS.map((g) => (
              <button
                key={g.id}
                onClick={() => handleGoalSelect(g.id)}
                className="glass-card rounded-2xl p-4 text-left hover:border-brand-accent/40 hover:shadow-glow-accent transition-smooth active:scale-95"
              >
                <span className="text-3xl">{g.icon}</span>
                <p className="font-bold text-white mt-3 text-sm">{g.label}</p>
                <p className="text-xs text-white/50 mt-0.5">{g.desc}</p>
                <p className="text-xs text-brand-accent mt-2 font-medium">{g.detail}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 1 — Experience Level */}
      {step === 1 && (
        <div className="flex-1 flex flex-col px-4 py-6 gap-4 animate-slide-up max-w-lg mx-auto w-full">
          <div className="mb-2">
            <h1 className="text-2xl font-bold text-white">
              Your experience <span className="text-gradient-brand">level?</span>
            </h1>
            <p className="text-sm text-white/50 mt-1">
              This determines how many days per week and which exercises we include.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            {LEVELS.map((l) => (
              <button
                key={l.id}
                onClick={() => handleLevelSelect(l.id)}
                className="glass-card rounded-2xl p-4 text-left flex items-center gap-4 hover:border-brand-accent/40 hover:shadow-glow-accent transition-smooth active:scale-95"
              >
                <span className="text-3xl shrink-0">{l.icon}</span>
                <div className="flex-1">
                  <div className="flex items-baseline gap-2">
                    <p className="font-bold text-white">{l.label}</p>
                    <span className="text-xs text-brand-accent font-semibold">
                      {l.daysPerWeek} days/week
                    </span>
                  </div>
                  <p className="text-xs text-white/50 mt-0.5">{l.desc}</p>
                </div>
                <ChevronRight size={16} className="text-white/30 shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2 — Plan Preview */}
      {step === 2 && preview && (
        <div className="flex-1 flex flex-col px-4 py-6 gap-4 animate-slide-up max-w-lg mx-auto w-full">
          <div className="mb-2">
            <h1 className="text-2xl font-bold text-white">
              Your{" "}
              <span className="text-gradient-brand">
                {preview.days.length}-day plan
              </span>
            </h1>
            <p className="text-sm text-white/50 mt-1">
              {selectedGoal?.label} · {experience} ·{" "}
              {experience === "beginner" ? "3" : experience === "intermediate" ? "4" : "5"} days/week
            </p>
          </div>

          <div className="flex flex-col gap-3 overflow-y-auto">
            {preview.days.map((day) => (
              <div key={day.dayLabel} className="glass-card rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Calendar size={14} className="text-brand-accent" />
                  <span className="text-xs font-bold text-brand-accent uppercase tracking-widest">
                    {day.dayLabel}
                  </span>
                  <span className="text-xs text-white/40 ml-1">— {day.focus}</span>
                </div>
                <div className="flex flex-col gap-2">
                  {day.exercises.map((ex) => (
                    <div
                      key={ex.exerciseId}
                      className="flex items-center gap-2.5 py-1"
                    >
                      <span className="text-base w-6 text-center">
                        {getExerciseIcon(ex.exerciseId)}
                      </span>
                      <span className="text-sm text-white/80 flex-1">
                        {getExerciseLabel(ex.exerciseId)}
                      </span>
                      <span className="text-xs text-white/40 shrink-0">
                        {ex.sets} ×{" "}
                        {ex.exerciseId === "plank"
                          ? `${ex.reps}s`
                          : `${ex.reps} reps`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={handleConfirm}
            className="mt-2 flex items-center justify-center gap-2 w-full py-4 rounded-2xl bg-gradient-accent text-brand-bg font-bold text-base shadow-glow-accent transition-smooth active:scale-95"
          >
            <Check size={18} />
            Looks great, start training!
          </button>
        </div>
      )}
    </div>
  );
}
