import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { CheckCircle2, Circle, Play, Trophy, LayoutList, Navigation } from "lucide-react";
import { EXERCISES } from "../exercises/index";
function getExercise(id) {
    return EXERCISES.find((e) => e.id === id);
}
export function WorkoutView({ plan, todayWorkout, todayDayIndex, completedSets, currentExerciseIdx, isWorkoutComplete, onStartExercise, onCompleteWorkout, }) {
    const [mode, setMode] = useState("guided");
    const totalSets = todayWorkout.exercises.reduce((sum, ex) => sum + ex.sets, 0);
    const doneSets = todayWorkout.exercises.reduce((sum, ex) => sum + Math.min(completedSets[ex.exerciseId] ?? 0, ex.sets), 0);
    const progressPct = totalSets > 0 ? (doneSets / totalSets) * 100 : 0;
    const goalLabel = plan.profile.goal === "strength"
        ? "Strength"
        : plan.profile.goal === "hypertrophy"
            ? "Muscle"
            : plan.profile.goal === "endurance"
                ? "Endurance"
                : "General Fit";
    if (isWorkoutComplete) {
        return (_jsxs("div", { className: "flex flex-col items-center justify-center gap-5 py-10 px-4 text-center animate-scale-in", children: [_jsx("div", { className: "w-20 h-20 rounded-full bg-gradient-accent flex items-center justify-center shadow-glow-accent", children: _jsx(Trophy, { size: 36, className: "text-brand-bg" }) }), _jsxs("div", { children: [_jsx("h2", { className: "text-xl font-bold text-white", children: "Workout Complete!" }), _jsxs("p", { className: "text-sm text-white/50 mt-1", children: [todayWorkout.focus, " \u00B7 ", doneSets, " sets done"] })] }), _jsx("button", { onClick: onCompleteWorkout, className: "px-8 py-3.5 rounded-2xl bg-gradient-accent text-brand-bg font-bold shadow-glow-accent transition-smooth active:scale-95", children: "Finish & save progress" })] }));
    }
    return (_jsxs("div", { className: "flex flex-col gap-4 px-1 pb-4 animate-fade-in", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsxs("p", { className: "text-xs text-brand-accent font-bold uppercase tracking-widest", children: [todayWorkout.dayLabel, " of ", plan.days.length, " \u2014 ", goalLabel] }), _jsx("h2", { className: "text-lg font-bold text-white mt-0.5", children: todayWorkout.focus })] }), _jsxs("span", { className: "text-xs text-white/40 font-medium", children: ["Day ", todayDayIndex + 1] })] }), _jsxs("div", { children: [_jsxs("div", { className: "flex items-center justify-between mb-1.5", children: [_jsx("span", { className: "text-xs text-white/40", children: "Sets done" }), _jsxs("span", { className: "text-xs font-semibold text-white/60", children: [doneSets, "/", totalSets] })] }), _jsx("div", { className: "h-1.5 rounded-full bg-white/10 overflow-hidden", children: _jsx("div", { className: "h-full rounded-full bg-gradient-accent transition-all duration-500", style: { width: `${progressPct}%` } }) })] }), _jsx("div", { className: "flex rounded-xl bg-white/5 p-1 gap-1", children: ["guided", "checklist"].map((m) => (_jsxs("button", { onClick: () => setMode(m), className: `flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-smooth ${mode === m
                        ? "bg-brand-accent text-brand-bg shadow-glow-accent-sm"
                        : "text-white/50 hover:text-white"}`, children: [m === "guided" ? (_jsx(Navigation, { size: 13 })) : (_jsx(LayoutList, { size: 13 })), m.charAt(0).toUpperCase() + m.slice(1)] }, m))) }), _jsx("div", { className: "flex flex-col gap-2", children: todayWorkout.exercises.map((planned, idx) => {
                    const exDef = getExercise(planned.exerciseId);
                    const done = completedSets[planned.exerciseId] ?? 0;
                    const allDone = done >= planned.sets;
                    const isCurrentGuided = mode === "guided" && idx === currentExerciseIdx;
                    const canStart = mode === "checklist" ? !allDone : isCurrentGuided;
                    const repsLabel = planned.exerciseId === "plank"
                        ? `${planned.reps}s hold`
                        : `${planned.reps} reps`;
                    return (_jsxs("div", { className: `glass-card rounded-2xl p-3.5 flex items-center gap-3 transition-smooth ${allDone ? "opacity-50" : ""} ${isCurrentGuided ? "border-brand-accent/40 shadow-glow-accent" : ""}`, children: [_jsx("div", { className: "shrink-0", children: allDone ? (_jsx(CheckCircle2, { size: 22, className: "text-brand-accent" })) : (_jsx(Circle, { size: 22, className: isCurrentGuided ? "text-brand-accent" : "text-white/20" })) }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx("span", { className: "text-base", children: exDef.icon ?? "🏋️" }), _jsx("span", { className: `text-sm font-semibold truncate ${allDone ? "line-through text-white/30" : "text-white"}`, children: exDef.label })] }), _jsxs("p", { className: "text-xs text-white/40 mt-0.5", children: [planned.sets, " sets \u00B7 ", repsLabel, " \u00B7 ", planned.restSec, "s rest"] }), !allDone && (_jsx("div", { className: "flex gap-1 mt-1.5", children: Array.from({ length: planned.sets }).map((_, si) => (_jsx("div", { className: `w-2 h-2 rounded-full transition-smooth ${si < done ? "bg-brand-accent" : "bg-white/15"}` }, si))) }))] }), canStart && (_jsxs("button", { onClick: () => onStartExercise(planned.exerciseId), className: "shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-accent text-brand-bg font-bold text-xs shadow-glow-accent-sm transition-smooth active:scale-95", children: [_jsx(Play, { size: 12 }), "Start"] }))] }, planned.exerciseId));
                }) }), mode === "guided" && (_jsx("p", { className: "text-xs text-white/30 text-center px-2", children: "Complete each set, then tap Stop. The coach auto-advances to the next exercise." }))] }));
}
