import { useState } from "react";
import { Flame, ChevronDown, Check, Trophy } from "lucide-react";
import type { StreakInfo } from "../lib/streaks";

interface StreakBadgeProps {
  streakInfo: StreakInfo;
}

export function StreakBadge({ streakInfo }: StreakBadgeProps) {
  const [expanded, setExpanded] = useState(false);
  const { currentStreak, longestStreak, isActiveToday } = streakInfo;

  return (
    <button
      type="button"
      onClick={() => setExpanded((p) => !p)}
      aria-label={`Streak: ${currentStreak} days`}
      className={`flex flex-col items-start gap-1 rounded-2xl glass-dark px-3 py-2 text-left transition-smooth focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent ${
        currentStreak > 0 ? "animate-pulse-glow" : ""
      }`}
    >
      {/* Compact pill row */}
      <div className="flex items-center gap-1.5">
        <Flame size={16} className={`leading-none shrink-0 ${ currentStreak > 0 ? "text-orange-400" : "text-slate-500" }`} />
        <span className="text-sm font-semibold text-white">
          {currentStreak}
          <span className="ml-0.5 text-slate-400 font-normal">day{currentStreak !== 1 ? "s" : ""}</span>
        </span>
        {isActiveToday && (
          <span className="ml-1 flex items-center gap-0.5 text-xs text-brand-accent font-medium">
            <Check size={11} />Today
          </span>
        )}
        <ChevronDown size={12} className={`ml-1 text-slate-500 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} />
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="animate-in fade-in slide-in-from-top-1 duration-150 mt-1 space-y-1 w-full">
          <div className="flex justify-between text-xs text-slate-300">
            <span>Current streak</span>
            <span className="font-semibold text-white">{currentStreak} day{currentStreak !== 1 ? "s" : ""}</span>
          </div>
          <div className="flex justify-between text-xs text-slate-300">
            <span>Longest streak</span>
            <span className="font-semibold text-white">{longestStreak} day{longestStreak !== 1 ? "s" : ""}</span>
          </div>
          {currentStreak > 0 && currentStreak === longestStreak && (
            <p className="text-xs text-brand-accent mt-0.5 flex items-center gap-1"><Trophy size={11} />On your longest streak!</p>
          )}
          {currentStreak === 0 && (
            <p className="text-xs text-slate-400 mt-0.5">Start your streak today 💪</p>
          )}
        </div>
      )}
    </button>
  );
}
