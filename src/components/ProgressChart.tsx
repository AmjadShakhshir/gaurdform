import { useMemo, useState } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import type { ExerciseId } from "../exercises/types";
import type { LocalSession } from "../lib/localDb";
import { getProgressData, type ProgressRange } from "../lib/progressData";

interface ProgressChartProps {
  exerciseId: ExerciseId;
  sessions: LocalSession[];
}

const RANGES: ProgressRange[] = ["7d", "30d", "90d"];

const W = 300;
const H = 120;
const PAD_L = 32;
const PAD_B = 24;
const PAD_T = 8;
const PAD_R = 8;
const CHART_W = W - PAD_L - PAD_R;
const CHART_H = H - PAD_B - PAD_T;

function scaleX(i: number, total: number): number {
  if (total <= 1) return PAD_L;
  return PAD_L + (i / (total - 1)) * CHART_W;
}

function scaleY(value: number): number {
  // 0–100 range
  return PAD_T + CHART_H - (value / 100) * CHART_H;
}

function polylinePoints(values: number[]): string {
  return values.map((v, i) => `${scaleX(i, values.length)},${scaleY(v)}`).join(" ");
}

function abbreviateDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function ProgressChart({ exerciseId, sessions }: ProgressChartProps) {
  const [range, setRange] = useState<ProgressRange>("30d");
  const [tooltip, setTooltip] = useState<{ x: number; y: number; label: string } | null>(null);

  const summary = useMemo(
    () => getProgressData(exerciseId, sessions, range),
    [exerciseId, sessions, range]
  );

  const { points } = summary;
  const avgScores = points.map((p) => p.avgScore);
  const bestScores = points.map((p) => p.bestScore);
  const n = points.length;

  // Trend label
  let trendLabel = "";
  let trendUp = true;
  if (summary.trendPercent !== null) {
    trendUp = summary.trendPercent >= 0;
    trendLabel = `${Math.abs(summary.trendPercent)}% this ${range === "7d" ? "week" : range === "30d" ? "month" : "3 months"}`;
  }

  function handleMouseMove(e: React.MouseEvent<SVGElement>) {
    if (n < 2) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const rawX = (e.clientX - rect.left) / (rect.width / W);
    const chartX = rawX - PAD_L;
    const step = CHART_W / (n - 1);
    const idx = Math.max(0, Math.min(n - 1, Math.round(chartX / step)));
    const pt = points[idx];
    if (!pt) return;
    setTooltip({
      x: scaleX(idx, n),
      y: scaleY(pt.avgScore),
      label: `${abbreviateDate(pt.date)}\nScore: ${Math.round(pt.avgScore)}\nReps: ${pt.totalReps}`,
    });
  }

  return (
    <div className="space-y-2">
      {/* Range selector */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={`text-xs px-2.5 py-1 rounded-lg transition-colors ${
                range === r
                  ? "bg-brand-accent text-white font-semibold"
                  : "bg-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
        {trendLabel && (
          <span className={`flex items-center gap-1 text-xs font-medium ${trendUp ? "text-brand-accent" : "text-brand-warn"}`}>
            {trendUp ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
            {trendLabel}
          </span>
        )}
      </div>

      {/* Chart */}
      {n < 2 ? (
        <div className="flex items-center justify-center h-24 rounded-xl glass-surface text-slate-500 text-sm">
          Not enough data yet — keep training!
        </div>
      ) : (
        <div className="relative rounded-xl overflow-hidden glass-surface">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full h-auto touch-none select-none"
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setTooltip(null)}
            onTouchEnd={() => setTooltip(null)}
          >
            <defs>
              <linearGradient id="avgFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
              </linearGradient>
            </defs>
            {/* Grid lines: 0, 50, 100 */}
            {[0, 50, 100].map((v) => (
              <g key={v}>
                <line
                  x1={PAD_L} y1={scaleY(v)}
                  x2={W - PAD_R} y2={scaleY(v)}
                  stroke="#334155" strokeWidth={0.5} strokeDasharray={v === 0 ? undefined : "3 3"}
                />
                <text x={PAD_L - 3} y={scaleY(v) + 3.5} textAnchor="end" className="fill-slate-500 text-[8px]" fontSize={8}>
                  {v}
                </text>
              </g>
            ))}

            {/* X-axis labels — show up to 5 */}
            {points
              .filter((_, i) => {
                if (n <= 5) return true;
                return i === 0 || i === n - 1 || i === Math.floor(n / 2);
              })
              .map((pt, _i) => {
                const origIdx = points.indexOf(pt);
                return (
                  <text
                    key={pt.date}
                    x={scaleX(origIdx, n)}
                    y={H - 4}
                    textAnchor="middle"
                    fontSize={7}
                    className="fill-slate-500"
                  >
                    {abbreviateDate(pt.date)}
                  </text>
                );
              })}

            {/* Avg score fill */}
            <polygon
              points={`${polylinePoints(avgScores)} ${scaleX(n - 1, n)},${scaleY(0)} ${scaleX(0, n)},${scaleY(0)}`}
              fill="url(#avgFill)"
            />

            {/* Best score: dashed white/30 */}
            <polyline
              points={polylinePoints(bestScores)}
              fill="none"
              stroke="rgba(255,255,255,0.25)"
              strokeWidth={1}
              strokeDasharray="3 3"
            />

            {/* Avg score: solid brand-accent */}
            <polyline
              points={polylinePoints(avgScores)}
              fill="none"
              stroke="#10b981"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Data dots for avg score */}
            {points.map((pt, i) => (
              <circle
                key={pt.date}
                cx={scaleX(i, n)}
                cy={scaleY(pt.avgScore)}
                r={2}
                fill="#10b981"
              />
            ))}

            {/* Tooltip */}
            {tooltip && (
              <g>
                <circle cx={tooltip.x} cy={tooltip.y} r={4} fill="#10b981" opacity={0.9} />
                <rect
                  x={Math.min(tooltip.x + 6, W - 76)}
                  y={Math.max(tooltip.y - 28, PAD_T)}
                  width={70}
                  height={40}
                  rx={4}
                  fill="rgba(15,23,42,0.9)"
                  stroke="rgba(16,185,129,0.3)"
                  strokeWidth={0.5}
                  opacity={0.95}
                />
                {tooltip.label.split("\n").map((line, i) => (
                  <text
                    key={i}
                    x={Math.min(tooltip.x + 11, W - 71)}
                    y={Math.max(tooltip.y - 16 + i * 11, PAD_T + 11 + i * 11)}
                    fontSize={7.5}
                    className={i === 0 ? "fill-slate-300" : "fill-slate-400"}
                  >
                    {line}
                  </text>
                ))}
              </g>
            )}
          </svg>

          {/* Legend */}
          <div className="absolute top-1.5 right-2 flex gap-3 text-[10px] text-slate-500">
            <span className="flex items-center gap-1">
              <span className="inline-block w-4 h-0.5 bg-brand-accent rounded" /> Avg
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-4 h-0.5 bg-white/25 rounded border-dashed" /> Best
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
