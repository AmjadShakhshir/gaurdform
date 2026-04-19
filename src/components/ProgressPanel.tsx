import { useMemo, useState } from "react";
import { Activity, Target, Calendar, Trophy, type LucideIcon } from "lucide-react";
import type { ExerciseId } from "../exercises/types";
import type { LocalSession, PersonalRecord } from "../lib/localDb";
import { EXERCISES } from "../exercises";
import { getProgressData } from "../lib/progressData";
import { ProgressChart } from "./ProgressChart";

interface ProgressPanelProps {
  sessions: LocalSession[];
  prs: PersonalRecord[];
}

function StatCard({ label, value, Icon }: { label: string; value: string | number; Icon: LucideIcon }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl glass-surface px-3 py-3 gap-1 hover:shadow-glow-accent-sm hover:scale-105 transition-smooth cursor-default">
      <Icon size={16} className="text-brand-accent" />
      <span className="text-base font-bold text-white">{value}</span>
      <span className="text-xs text-slate-400 text-center leading-tight">{label}</span>
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function ProgressPanel({ sessions, prs }: ProgressPanelProps) {
  const exercisesWithSessions = useMemo(() => {
    const ids = new Set(sessions.map((s) => s.exercise));
    return EXERCISES.filter((e) => ids.has(e.id));
  }, [sessions]);

  const [selectedId, setSelectedId] = useState<ExerciseId>(
    exercisesWithSessions[0]?.id ?? ("squat" as ExerciseId)
  );

  const exerciseSessions = useMemo(
    () => sessions.filter((s) => s.exercise === selectedId),
    [sessions, selectedId]
  );

  const exercisePRs = useMemo(
    () => prs.filter((pr) => pr.exerciseId === selectedId),
    [prs, selectedId]
  );

  const summary30d = useMemo(
    () => getProgressData(selectedId, sessions, "30d"),
    [selectedId, sessions]
  );

  const lastSession = exerciseSessions[0];

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-2 text-center px-4">
        <Activity size={40} className="text-slate-600" />
        <p className="text-white font-semibold">No sessions yet</p>
        <p className="text-sm text-slate-400">Complete a workout to see your progress here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-4">
      {/* Exercise selector */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
        {exercisesWithSessions.map((ex) => (
          <button
            key={ex.id}
            type="button"
            onClick={() => setSelectedId(ex.id)}
            className={`flex-shrink-0 rounded-xl px-3 py-1.5 text-xs font-medium transition-smooth ${
              selectedId === ex.id
                ? "bg-gradient-accent text-white shadow-glow-accent-sm"
                : "glass-surface text-slate-400 hover:text-white"
            }`}
          >
            {ex.label}
          </button>
        ))}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-2">
        <StatCard label="Sessions" value={summary30d.totalSessions} Icon={Activity} />
        <StatCard label="Total Reps" value={summary30d.totalReps} Icon={Target} />
        <StatCard
          label="Best Score"
          value={summary30d.latestScore != null ? Math.round(summary30d.latestScore) : "—"}
          Icon={Trophy}
        />
        <StatCard
          label="Last Trained"
          value={lastSession ? formatDate(lastSession.created_at!) : "—"}
          Icon={Calendar}
        />
      </div>

      {/* Progress chart */}
      <ProgressChart exerciseId={selectedId} sessions={sessions} />

      {/* Personal records */}
      {exercisePRs.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Personal Records
          </h3>
          <ul className="space-y-1.5">
            {exercisePRs.map((pr) => (
              <li
                key={pr.metric}
                className="flex justify-between items-center rounded-xl glass-surface px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <Trophy size={14} className="text-amber-400" />
                  <span className="text-sm text-slate-300">{pr.label}</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-semibold text-brand-accent">
                    {Math.round(pr.value * 10) / 10}
                  </span>
                  <span className="text-xs text-slate-500 ml-0.5">
                    {formatDate(pr.date)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
