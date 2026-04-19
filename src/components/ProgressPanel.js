import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from "react";
import { Activity, Target, Calendar, Trophy } from "lucide-react";
import { EXERCISES } from "../exercises";
import { getProgressData } from "../lib/progressData";
import { ProgressChart } from "./ProgressChart";
function StatCard({ label, value, Icon }) {
    return (_jsxs("div", { className: "flex flex-col items-center justify-center rounded-xl glass-surface px-3 py-3 gap-1 hover:shadow-glow-accent-sm hover:scale-105 transition-smooth cursor-default", children: [_jsx(Icon, { size: 16, className: "text-brand-accent" }), _jsx("span", { className: "text-base font-bold text-white", children: value }), _jsx("span", { className: "text-xs text-slate-400 text-center leading-tight", children: label })] }));
}
function formatDate(iso) {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
export function ProgressPanel({ sessions, prs }) {
    const exercisesWithSessions = useMemo(() => {
        const ids = new Set(sessions.map((s) => s.exercise));
        return EXERCISES.filter((e) => ids.has(e.id));
    }, [sessions]);
    const [selectedId, setSelectedId] = useState(exercisesWithSessions[0]?.id ?? "squat");
    const exerciseSessions = useMemo(() => sessions.filter((s) => s.exercise === selectedId), [sessions, selectedId]);
    const exercisePRs = useMemo(() => prs.filter((pr) => pr.exerciseId === selectedId), [prs, selectedId]);
    const summary30d = useMemo(() => getProgressData(selectedId, sessions, "30d"), [selectedId, sessions]);
    const lastSession = exerciseSessions[0];
    if (sessions.length === 0) {
        return (_jsxs("div", { className: "flex flex-col items-center justify-center py-12 gap-2 text-center px-4", children: [_jsx(Activity, { size: 40, className: "text-slate-600" }), _jsx("p", { className: "text-white font-semibold", children: "No sessions yet" }), _jsx("p", { className: "text-sm text-slate-400", children: "Complete a workout to see your progress here." })] }));
    }
    return (_jsxs("div", { className: "space-y-4 pb-4", children: [_jsx("div", { className: "flex gap-2 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1", children: exercisesWithSessions.map((ex) => (_jsx("button", { type: "button", onClick: () => setSelectedId(ex.id), className: `flex-shrink-0 rounded-xl px-3 py-1.5 text-xs font-medium transition-smooth ${selectedId === ex.id
                        ? "bg-gradient-accent text-white shadow-glow-accent-sm"
                        : "glass-surface text-slate-400 hover:text-white"}`, children: ex.label }, ex.id))) }), _jsxs("div", { className: "grid grid-cols-4 gap-2", children: [_jsx(StatCard, { label: "Sessions", value: summary30d.totalSessions, Icon: Activity }), _jsx(StatCard, { label: "Total Reps", value: summary30d.totalReps, Icon: Target }), _jsx(StatCard, { label: "Best Score", value: summary30d.latestScore != null ? Math.round(summary30d.latestScore) : "—", Icon: Trophy }), _jsx(StatCard, { label: "Last Trained", value: lastSession ? formatDate(lastSession.created_at) : "—", Icon: Calendar })] }), _jsx(ProgressChart, { exerciseId: selectedId, sessions: sessions }), exercisePRs.length > 0 && (_jsxs("div", { children: [_jsx("h3", { className: "text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2", children: "Personal Records" }), _jsx("ul", { className: "space-y-1.5", children: exercisePRs.map((pr) => (_jsxs("li", { className: "flex justify-between items-center rounded-xl glass-surface px-3 py-2", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Trophy, { size: 14, className: "text-amber-400" }), _jsx("span", { className: "text-sm text-slate-300", children: pr.label })] }), _jsxs("div", { className: "text-right", children: [_jsx("span", { className: "text-sm font-semibold text-brand-accent", children: Math.round(pr.value * 10) / 10 }), _jsx("span", { className: "text-xs text-slate-500 ml-0.5", children: formatDate(pr.date) })] })] }, pr.metric))) })] }))] }));
}
