import { useEffect, useRef } from "react";
import { Trophy } from "lucide-react";
import type { DetectedPR } from "../lib/personalRecords";

interface PRCelebrationProps {
  prs: DetectedPR[];
  onDismiss: () => void;
}

const CONFETTI_COLORS = [
  "bg-brand-accent", "bg-brand-warn", "bg-purple-400",
  "bg-pink-400", "bg-sky-400", "bg-yellow-300",
];

function formatValue(pr: DetectedPR): string {
  const v = Math.round(pr.newValue * 10) / 10;
  return `${v}${pr.unit}`;
}

function formatImprovement(pr: DetectedPR): string | null {
  if (pr.previousValue == null) return null;
  // For angle metrics (invertForComparison), improvement means smaller angle
  const improved = pr.invertForComparison
    ? pr.previousValue - pr.newValue
    : pr.newValue - pr.previousValue;
  if (improved <= 0) return null;
  const rounded = Math.round(improved * 10) / 10;
  return `+${rounded}${pr.unit} better`;
}

export function PRCelebration({ prs, onDismiss }: PRCelebrationProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Web Audio API chime
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.5);
    } catch {
      // Audio not available — ignore
    }

    // Auto-dismiss
    timerRef.current = setTimeout(onDismiss, 4000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [onDismiss]);

  if (prs.length === 0) return null;

  return (
    <div
      role="dialog"
      aria-label="Personal Record achieved"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onDismiss}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Confetti */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
        {Array.from({ length: 24 }).map((_, i) => (
          <div
            key={i}
            className={`absolute w-2 h-2 rounded-sm animate-confetti-fall ${CONFETTI_COLORS[i % CONFETTI_COLORS.length]}`}
            style={{
              left: `${(i * 37 + 7) % 100}%`,
              ["--fall-duration" as string]: `${1.8 + (i % 5) * 0.4}s`,
              ["--fall-delay" as string]: `${(i * 0.06) % 0.8}s`,
              ["--rot-start" as string]: `${i * 17}deg`,
              ["--rot-end" as string]: `${i * 17 + (i % 2 === 0 ? 540 : -360)}deg`,
            }}
          />
        ))}
      </div>

      {/* Card */}
      <div
        role="presentation"
        className="relative z-10 w-full max-w-sm rounded-2xl glass-card border-brand-accent/30 p-6 shadow-glow-accent animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center mb-4">
          <Trophy size={40} className="text-amber-400 mx-auto mb-2" />
          <h2 className="text-xl font-bold text-white">
            New Personal Record{prs.length > 1 ? "s" : ""}!
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">You're crushing it 💪</p>
        </div>

        <ul className="space-y-2 mb-5">
          {prs.map((pr) => {
            const improvement = formatImprovement(pr);
            return (
              <li key={pr.metric} className="flex justify-between items-center rounded-xl glass-surface px-4 py-2.5">
                <span className="text-sm text-slate-300">{pr.label}</span>
                <div className="text-right">
                  <span className="text-sm font-semibold text-brand-accent">{formatValue(pr)}</span>
                  {improvement && (
                    <div className="text-xs text-slate-400">{improvement}</div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        <button
          type="button"
          onClick={onDismiss}
          className="w-full rounded-xl bg-gradient-accent hover:shadow-glow-accent transition-smooth py-2.5 text-sm font-semibold text-white"
        >
          Awesome!
        </button>

        <p className="text-center text-xs text-slate-600 mt-2">Auto-closes in a few seconds</p>
      </div>
    </div>
  );
}
