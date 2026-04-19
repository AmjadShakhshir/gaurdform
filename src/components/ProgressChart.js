import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { getProgressData } from "../lib/progressData";
const RANGES = ["7d", "30d", "90d"];
const W = 300;
const H = 120;
const PAD_L = 32;
const PAD_B = 24;
const PAD_T = 8;
const PAD_R = 8;
const CHART_W = W - PAD_L - PAD_R;
const CHART_H = H - PAD_B - PAD_T;
function scaleX(i, total) {
    if (total <= 1)
        return PAD_L;
    return PAD_L + (i / (total - 1)) * CHART_W;
}
function scaleY(value) {
    // 0–100 range
    return PAD_T + CHART_H - (value / 100) * CHART_H;
}
function polylinePoints(values) {
    return values.map((v, i) => `${scaleX(i, values.length)},${scaleY(v)}`).join(" ");
}
function abbreviateDate(iso) {
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
export function ProgressChart({ exerciseId, sessions }) {
    const [range, setRange] = useState("30d");
    const [tooltip, setTooltip] = useState(null);
    const summary = useMemo(() => getProgressData(exerciseId, sessions, range), [exerciseId, sessions, range]);
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
    function handleMouseMove(e) {
        if (n < 2)
            return;
        const rect = e.currentTarget.getBoundingClientRect();
        const rawX = (e.clientX - rect.left) / (rect.width / W);
        const chartX = rawX - PAD_L;
        const step = CHART_W / (n - 1);
        const idx = Math.max(0, Math.min(n - 1, Math.round(chartX / step)));
        const pt = points[idx];
        if (!pt)
            return;
        setTooltip({
            x: scaleX(idx, n),
            y: scaleY(pt.avgScore),
            label: `${abbreviateDate(pt.date)}\nScore: ${Math.round(pt.avgScore)}\nReps: ${pt.totalReps}`,
        });
    }
    return (_jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("div", { className: "flex gap-1", children: RANGES.map((r) => (_jsx("button", { type: "button", onClick: () => setRange(r), className: `text-xs px-2.5 py-1 rounded-lg transition-colors ${range === r
                                ? "bg-brand-accent text-white font-semibold"
                                : "bg-slate-800 text-slate-400 hover:text-white"}`, children: r }, r))) }), trendLabel && (_jsxs("span", { className: `flex items-center gap-1 text-xs font-medium ${trendUp ? "text-brand-accent" : "text-brand-warn"}`, children: [trendUp ? _jsx(TrendingUp, { size: 13 }) : _jsx(TrendingDown, { size: 13 }), trendLabel] }))] }), n < 2 ? (_jsx("div", { className: "flex items-center justify-center h-24 rounded-xl glass-surface text-slate-500 text-sm", children: "Not enough data yet \u2014 keep training!" })) : (_jsxs("div", { className: "relative rounded-xl overflow-hidden glass-surface", children: [_jsxs("svg", { viewBox: `0 0 ${W} ${H}`, className: "w-full h-auto touch-none select-none", onMouseMove: handleMouseMove, onMouseLeave: () => setTooltip(null), onTouchEnd: () => setTooltip(null), children: [_jsx("defs", { children: _jsxs("linearGradient", { id: "avgFill", x1: "0", y1: "0", x2: "0", y2: "1", children: [_jsx("stop", { offset: "0%", stopColor: "#10b981", stopOpacity: "0.25" }), _jsx("stop", { offset: "100%", stopColor: "#10b981", stopOpacity: "0" })] }) }), [0, 50, 100].map((v) => (_jsxs("g", { children: [_jsx("line", { x1: PAD_L, y1: scaleY(v), x2: W - PAD_R, y2: scaleY(v), stroke: "#334155", strokeWidth: 0.5, strokeDasharray: v === 0 ? undefined : "3 3" }), _jsx("text", { x: PAD_L - 3, y: scaleY(v) + 3.5, textAnchor: "end", className: "fill-slate-500 text-[8px]", fontSize: 8, children: v })] }, v))), points
                                .filter((_, i) => {
                                if (n <= 5)
                                    return true;
                                return i === 0 || i === n - 1 || i === Math.floor(n / 2);
                            })
                                .map((pt, _i) => {
                                const origIdx = points.indexOf(pt);
                                return (_jsx("text", { x: scaleX(origIdx, n), y: H - 4, textAnchor: "middle", fontSize: 7, className: "fill-slate-500", children: abbreviateDate(pt.date) }, pt.date));
                            }), _jsx("polygon", { points: `${polylinePoints(avgScores)} ${scaleX(n - 1, n)},${scaleY(0)} ${scaleX(0, n)},${scaleY(0)}`, fill: "url(#avgFill)" }), _jsx("polyline", { points: polylinePoints(bestScores), fill: "none", stroke: "rgba(255,255,255,0.25)", strokeWidth: 1, strokeDasharray: "3 3" }), _jsx("polyline", { points: polylinePoints(avgScores), fill: "none", stroke: "#10b981", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" }), points.map((pt, i) => (_jsx("circle", { cx: scaleX(i, n), cy: scaleY(pt.avgScore), r: 2, fill: "#10b981" }, pt.date))), tooltip && (_jsxs("g", { children: [_jsx("circle", { cx: tooltip.x, cy: tooltip.y, r: 4, fill: "#10b981", opacity: 0.9 }), _jsx("rect", { x: Math.min(tooltip.x + 6, W - 76), y: Math.max(tooltip.y - 28, PAD_T), width: 70, height: 40, rx: 4, fill: "rgba(15,23,42,0.9)", stroke: "rgba(16,185,129,0.3)", strokeWidth: 0.5, opacity: 0.95 }), tooltip.label.split("\n").map((line, i) => (_jsx("text", { x: Math.min(tooltip.x + 11, W - 71), y: Math.max(tooltip.y - 16 + i * 11, PAD_T + 11 + i * 11), fontSize: 7.5, className: i === 0 ? "fill-slate-300" : "fill-slate-400", children: line }, i)))] }))] }), _jsxs("div", { className: "absolute top-1.5 right-2 flex gap-3 text-[10px] text-slate-500", children: [_jsxs("span", { className: "flex items-center gap-1", children: [_jsx("span", { className: "inline-block w-4 h-0.5 bg-brand-accent rounded" }), " Avg"] }), _jsxs("span", { className: "flex items-center gap-1", children: [_jsx("span", { className: "inline-block w-4 h-0.5 bg-white/25 rounded border-dashed" }), " Best"] })] })] }))] }));
}
