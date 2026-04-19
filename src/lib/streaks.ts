import type { LocalSession } from "./localDb";

export interface StreakInfo {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string | null; // YYYY-MM-DD
  isActiveToday: boolean;
}

/** Convert a Date or ISO string to a local YYYY-MM-DD string. */
function toLocalDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("sv"); // "sv" locale gives YYYY-MM-DD
}

/** Get today's local date as YYYY-MM-DD. */
function today(): string {
  return new Date().toLocaleDateString("sv");
}

/** Get yesterday's local date as YYYY-MM-DD. */
function yesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toLocaleDateString("sv");
}

/**
 * Compute streak info from a list of sessions.
 * A streak is consecutive calendar days (local timezone) with ≥1 session.
 */
export function computeStreak(sessions: LocalSession[]): StreakInfo {
  if (sessions.length === 0) {
    return { currentStreak: 0, longestStreak: 0, lastActiveDate: null, isActiveToday: false };
  }

  // Build sorted unique set of active dates (YYYY-MM-DD), newest first
  const dateSet = new Set(
    sessions
      .filter((s) => s.created_at)
      .map((s) => toLocalDate(s.created_at!))
  );
  const dates = Array.from(dateSet).sort((a, b) => b.localeCompare(a));

  const todayStr = today();
  const yesterdayStr = yesterday();
  const lastActiveDate = dates[0] ?? null;
  const isActiveToday = lastActiveDate === todayStr;

  // Current streak: walk backwards from today (or yesterday if not active today)
  let currentStreak = 0;
  let cursor = isActiveToday ? todayStr : yesterdayStr;

  for (const date of dates) {
    if (date === cursor) {
      currentStreak++;
      // Move cursor back one day
      const d = new Date(cursor + "T00:00:00");
      d.setDate(d.getDate() - 1);
      cursor = d.toLocaleDateString("sv");
    } else if (date < cursor) {
      // Gap in dates — streak is broken
      break;
    }
  }

  // Longest streak: sliding window over sorted unique dates
  const sortedAsc = [...dates].sort();
  let longestStreak = 0;
  let runLength = 1;
  for (let i = 1; i < sortedAsc.length; i++) {
    const prev = new Date(sortedAsc[i - 1] + "T00:00:00");
    const curr = new Date(sortedAsc[i] + "T00:00:00");
    const diffDays = Math.round((curr.getTime() - prev.getTime()) / 86400000);
    if (diffDays === 1) {
      runLength++;
    } else {
      longestStreak = Math.max(longestStreak, runLength);
      runLength = 1;
    }
  }
  longestStreak = Math.max(longestStreak, runLength);

  return { currentStreak, longestStreak, lastActiveDate, isActiveToday };
}
