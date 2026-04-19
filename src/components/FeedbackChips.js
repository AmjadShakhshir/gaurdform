import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { CheckCircle, AlertTriangle, XCircle, ShieldAlert } from "lucide-react";
const severityStyles = {
    good: "glass-card border-emerald-500/30 text-emerald-200 shadow-glow-accent-sm",
    warn: "glass-card border-amber-500/30  text-amber-200",
    error: "glass-card border-red-500/30    text-red-200 shadow-glow-err",
    critical: "glass-card border-red-600/60    text-white   shadow-glow-err bg-red-900/40",
};
const severityIconComponent = {
    good: _jsx(CheckCircle, { size: 15, className: "shrink-0 text-emerald-400" }),
    warn: _jsx(AlertTriangle, { size: 15, className: "shrink-0 text-amber-400" }),
    error: _jsx(XCircle, { size: 15, className: "shrink-0 text-red-400" }),
    critical: _jsx(ShieldAlert, { size: 15, className: "shrink-0 text-red-300" }),
};
export function FeedbackChips({ items }) {
    if (items.length === 0)
        return null;
    return (_jsx("div", { className: "flex flex-wrap gap-2 justify-center", children: items.map((f, i) => (_jsxs("div", { className: `px-3 py-1.5 rounded-2xl font-medium shadow-lg text-sm flex items-center gap-2 animate-slide-up stagger-${Math.min(i + 1, 6)} ${f.severity === "error" || f.severity === "critical" ? "animate-pulse-glow" : ""} ${severityStyles[f.severity]}`, children: [severityIconComponent[f.severity], f.message] }, f.id))) }));
}
