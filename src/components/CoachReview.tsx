import { useState, useEffect, useRef } from "react";
import { Brain, Loader2 } from "lucide-react";
import { coachReview, geminiEnabled } from "../lib/gemini";
import type { ExerciseState, RepSummary, ExerciseId } from "../exercises/types";
import type { ViewAngle } from "../lib/viewAngle";

interface Props {
  exercise: ExerciseId;
  state: ExerciseState;
  /** When true, auto-fires a review (e.g. after set-complete). */
  autoTrigger?: boolean;
  /** Camera orientation — forwarded to Gemini for more accurate coaching. */
  viewAngle?: ViewAngle;
}

function localSummary(reps: RepSummary[]): string {
  if (reps.length === 0) return "No reps to summarize.";
  const scores = reps.map((r) => r.metrics.score ?? 0);
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  const best  = reps.reduce((b, r) => (r.metrics.score ?? 0) >= (b.metrics.score ?? 0) ? r : b);
  const worst = reps.reduce((w, r) => (r.metrics.score ?? 0) <= (w.metrics.score ?? 0) ? r : w);
  return `Set summary: avg ${Math.round(avg)}/100 across ${reps.length} reps. Best was rep ${best.repIndex} (${best.metrics.score}/100), most room to improve on rep ${worst.repIndex} (${worst.metrics.score}/100).`;
}

export function CoachReview({ exercise, state, autoTrigger, viewAngle }: Props) {
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<string | null>(null);
  const autoTriggeredRef = useRef(false);

  const onReview = async () => {
    if (loading) return;
    setLoading(true);
    setResponse(null);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12_000);
      const text = await coachReview(exercise, state.repLog, controller.signal, viewAngle);
      clearTimeout(timeoutId);
      setResponse(text);
    } catch (err) {
      // Fallback: local summary when Gemini is unavailable or timed out.
      const isRateLimit = err instanceof Error && err.message.includes("rate limited");
      const prefix = geminiEnabled
        ? isRateLimit
          ? "Gemini is rate-limited right now. "
          : "Coach offline. "
        : "";
      setResponse(prefix + localSummary(state.repLog));
    } finally {
      setLoading(false);
    }
  };

  // Auto-trigger once when the set completes.
  useEffect(() => {
    if (autoTrigger && state.reps > 0 && !autoTriggeredRef.current) {
      autoTriggeredRef.current = true;
      onReview();
    }
    if (!autoTrigger) {
      autoTriggeredRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoTrigger]);

  return (
    <div className="rounded-2xl glass-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-100 flex items-center gap-2">
            <Brain size={18} className="text-brand-accent" />
            AI Coach Review
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {geminiEnabled
              ? "Sends only numeric metrics — never video."
              : "Add VITE_GEMINI_API_KEY in .env to enable AI review."}
          </p>
        </div>
        <button
          onClick={onReview}
          disabled={loading || state.reps === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-accent text-white font-semibold text-sm disabled:opacity-40 shadow-glow-accent-sm hover:shadow-glow-accent transition-smooth"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : null}
          {loading ? "Thinking…" : `Review ${state.reps} reps`}
        </button>
      </div>
      {response && (
        <p className="text-sm text-slate-200 leading-relaxed border-l-2 border-brand-accent pl-3 animate-fade-in">
          {response}
        </p>
      )}
    </div>
  );
}
