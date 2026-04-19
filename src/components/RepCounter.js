import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useRef, useEffect } from "react";
const phaseColor = {
    CALIBRATING: "bg-slate-500",
    READY: "bg-slate-600",
    DESCENDING: "bg-brand-warn",
    BOTTOM: "bg-brand-err",
    TOP: "bg-brand-err",
    ASCENDING: "bg-brand-accent",
    HOLDING: "bg-brand-accent",
};
const phaseLabel = {
    CALIBRATING: "Calibrating…",
    READY: "READY",
    DESCENDING: "DESCENDING",
    BOTTOM: "BOTTOM",
    TOP: "TOP",
    ASCENDING: "ASCENDING",
    HOLDING: "HOLDING",
};
export function RepCounter({ state, compact = false, targetCount = 10, valueOverride, counterUnit = "reps", }) {
    const currentValue = valueOverride ?? state.reps;
    const prevRepsRef = useRef(currentValue);
    const ringRef = useRef(null);
    // Pulse animation on rep increment
    useEffect(() => {
        if (currentValue > prevRepsRef.current && ringRef.current) {
            ringRef.current.classList.remove("animate-rep-pulse");
            void ringRef.current.offsetWidth; // reflow
            ringRef.current.classList.add("animate-rep-pulse");
        }
        prevRepsRef.current = currentValue;
    }, [currentValue]);
    const progress = Math.min(currentValue / Math.max(1, targetCount), 1);
    const size = compact ? 72 : 112;
    const cx = size / 2;
    const radius = compact ? 26 : 40;
    const strokeWidth = compact ? 5 : 8;
    const circumference = 2 * Math.PI * radius;
    const dashOffset = circumference * (1 - progress);
    const isComplete = currentValue >= targetCount;
    const ringColor = isComplete ? "#10b981" : "#6366f1";
    const ringGlow = isComplete ? "drop-shadow(0 0 8px rgba(16,185,129,0.7))" : "drop-shadow(0 0 6px rgba(99,102,241,0.6))";
    const displayValue = counterUnit === "s" ? Math.floor(currentValue) : currentValue;
    const targetLabel = counterUnit === "s" ? `${targetCount}s` : targetCount;
    return (_jsxs("div", { className: `flex items-center ${compact ? "gap-3" : "gap-6"}`, children: [_jsxs("div", { ref: ringRef, className: `relative flex items-center justify-center ${compact ? "w-[72px] h-[72px]" : "w-28 h-28"}`, children: [_jsxs("svg", { className: "absolute", width: size, height: size, "aria-hidden": "true", style: { filter: ringGlow }, children: [_jsx("circle", { cx: cx, cy: cx, r: radius, fill: "none", stroke: "rgba(30,41,59,0.8)", strokeWidth: strokeWidth }), _jsx("circle", { cx: cx, cy: cx, r: radius, fill: "none", stroke: ringColor, strokeWidth: strokeWidth, strokeDasharray: circumference, strokeDashoffset: dashOffset, strokeLinecap: "round", transform: `rotate(-90 ${cx} ${cx})`, style: { transition: "stroke-dashoffset 0.35s ease, stroke 0.35s ease" } })] }), _jsxs("div", { className: "text-center z-10", children: [_jsx("div", { className: `${compact ? "text-2xl" : "text-4xl"} font-bold tabular-nums leading-none ${isComplete ? "text-gradient-accent" : ""}`, children: displayValue }), _jsxs("div", { className: `${compact ? "text-[10px]" : "text-xs"} text-slate-400 mt-0.5`, children: [displayValue, "/", targetLabel] })] })] }), compact ? (_jsx("div", { className: `px-2 py-1 rounded-md text-xs font-bold ${phaseColor[state.phase] ?? "bg-slate-600"}`, children: phaseLabel[state.phase] ?? state.phase })) : (_jsxs("div", { className: "flex flex-col gap-1", children: [_jsx("div", { className: "text-xs uppercase tracking-widest text-slate-400", children: "Phase" }), _jsx("div", { className: `px-3 py-1 rounded-md text-sm font-bold ${phaseColor[state.phase] ?? "bg-slate-600"}`, children: phaseLabel[state.phase] ?? state.phase })] }))] }));
}
