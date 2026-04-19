import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Check, Calendar } from "lucide-react";
import { generatePlan } from "../lib/planTemplates";
import { EXERCISES } from "../exercises/index";
const GOALS = [
    {
        id: "strength",
        label: "Strength",
        icon: "🏋️",
        desc: "Lift heavy, get strong",
        detail: "Low reps · Heavy weight · Long rest",
    },
    {
        id: "hypertrophy",
        label: "Muscle",
        icon: "💪",
        desc: "Build size and shape",
        detail: "Moderate reps · Pump focus · Structured rest",
    },
    {
        id: "endurance",
        label: "Endurance",
        icon: "🏃",
        desc: "Train longer, stronger",
        detail: "High reps · Short rest · Conditioning",
    },
    {
        id: "general",
        label: "General Fit",
        icon: "⚡",
        desc: "Balanced overall health",
        detail: "All-around · Great for beginners",
    },
];
const LEVELS = [
    {
        id: "beginner",
        label: "Beginner",
        icon: "🌱",
        desc: "Less than 1 year of consistent training",
        daysPerWeek: 3,
    },
    {
        id: "intermediate",
        label: "Intermediate",
        icon: "🔥",
        desc: "1–3 years of regular gym experience",
        daysPerWeek: 4,
    },
    {
        id: "advanced",
        label: "Advanced",
        icon: "⚔️",
        desc: "3+ years, comfortable with compound lifts",
        daysPerWeek: 5,
    },
];
export function PlanBuilder({ onConfirm }) {
    const [step, setStep] = useState(0);
    const [goal, setGoal] = useState(null);
    const [experience, setExperience] = useState(null);
    const [preview, setPreview] = useState(null);
    function handleGoalSelect(g) {
        setGoal(g);
        setStep(1);
    }
    function handleLevelSelect(e) {
        setExperience(e);
        const profile = {
            goal: goal,
            experience: e,
            createdAt: new Date().toISOString(),
        };
        setPreview(generatePlan(profile));
        setStep(2);
    }
    function handleConfirm() {
        if (!preview)
            return;
        onConfirm(preview.profile, preview);
    }
    function getExerciseLabel(id) {
        return EXERCISES.find((e) => e.id === id)?.label ?? id;
    }
    function getExerciseIcon(id) {
        return EXERCISES.find((e) => e.id === id)?.icon ?? "🏋️";
    }
    const selectedGoal = GOALS.find((g) => g.id === goal);
    return (_jsxs("div", { className: "min-h-screen bg-brand-bg flex flex-col", children: [_jsxs("div", { className: "glass-dark border-b border-white/5 px-4 py-4 flex items-center gap-3 pt-safe-top", children: [step > 0 && (_jsx("button", { onClick: () => setStep((s) => s - 1), className: "w-9 h-9 flex items-center justify-center rounded-full glass-card text-white/60 hover:text-white transition-smooth", children: _jsx(ChevronLeft, { size: 18 }) })), _jsxs("div", { className: "flex-1", children: [_jsxs("p", { className: "text-xs text-white/40 uppercase tracking-widest font-semibold", children: ["Step ", step + 1, " of 3"] }), _jsx("div", { className: "mt-1.5 h-1 rounded-full bg-white/10 overflow-hidden", children: _jsx("div", { className: "h-full rounded-full bg-gradient-accent transition-all duration-500", style: { width: `${((step + 1) / 3) * 100}%` } }) })] })] }), step === 0 && (_jsxs("div", { className: "flex-1 flex flex-col px-4 py-6 gap-4 animate-slide-up max-w-lg mx-auto w-full", children: [_jsxs("div", { className: "mb-2", children: [_jsxs("h1", { className: "text-2xl font-bold text-white", children: ["What's your fitness ", _jsx("span", { className: "text-gradient-brand", children: "goal?" })] }), _jsx("p", { className: "text-sm text-white/50 mt-1", children: "We'll build a personalised weekly plan around your objective." })] }), _jsx("div", { className: "grid grid-cols-2 gap-3", children: GOALS.map((g) => (_jsxs("button", { onClick: () => handleGoalSelect(g.id), className: "glass-card rounded-2xl p-4 text-left hover:border-brand-accent/40 hover:shadow-glow-accent transition-smooth active:scale-95", children: [_jsx("span", { className: "text-3xl", children: g.icon }), _jsx("p", { className: "font-bold text-white mt-3 text-sm", children: g.label }), _jsx("p", { className: "text-xs text-white/50 mt-0.5", children: g.desc }), _jsx("p", { className: "text-xs text-brand-accent mt-2 font-medium", children: g.detail })] }, g.id))) })] })), step === 1 && (_jsxs("div", { className: "flex-1 flex flex-col px-4 py-6 gap-4 animate-slide-up max-w-lg mx-auto w-full", children: [_jsxs("div", { className: "mb-2", children: [_jsxs("h1", { className: "text-2xl font-bold text-white", children: ["Your experience ", _jsx("span", { className: "text-gradient-brand", children: "level?" })] }), _jsx("p", { className: "text-sm text-white/50 mt-1", children: "This determines how many days per week and which exercises we include." })] }), _jsx("div", { className: "flex flex-col gap-3", children: LEVELS.map((l) => (_jsxs("button", { onClick: () => handleLevelSelect(l.id), className: "glass-card rounded-2xl p-4 text-left flex items-center gap-4 hover:border-brand-accent/40 hover:shadow-glow-accent transition-smooth active:scale-95", children: [_jsx("span", { className: "text-3xl shrink-0", children: l.icon }), _jsxs("div", { className: "flex-1", children: [_jsxs("div", { className: "flex items-baseline gap-2", children: [_jsx("p", { className: "font-bold text-white", children: l.label }), _jsxs("span", { className: "text-xs text-brand-accent font-semibold", children: [l.daysPerWeek, " days/week"] })] }), _jsx("p", { className: "text-xs text-white/50 mt-0.5", children: l.desc })] }), _jsx(ChevronRight, { size: 16, className: "text-white/30 shrink-0" })] }, l.id))) })] })), step === 2 && preview && (_jsxs("div", { className: "flex-1 flex flex-col px-4 py-6 gap-4 animate-slide-up max-w-lg mx-auto w-full", children: [_jsxs("div", { className: "mb-2", children: [_jsxs("h1", { className: "text-2xl font-bold text-white", children: ["Your", " ", _jsxs("span", { className: "text-gradient-brand", children: [preview.days.length, "-day plan"] })] }), _jsxs("p", { className: "text-sm text-white/50 mt-1", children: [selectedGoal?.label, " \u00B7 ", experience, " \u00B7", " ", experience === "beginner" ? "3" : experience === "intermediate" ? "4" : "5", " days/week"] })] }), _jsx("div", { className: "flex flex-col gap-3 overflow-y-auto", children: preview.days.map((day) => (_jsxs("div", { className: "glass-card rounded-2xl p-4", children: [_jsxs("div", { className: "flex items-center gap-2 mb-3", children: [_jsx(Calendar, { size: 14, className: "text-brand-accent" }), _jsx("span", { className: "text-xs font-bold text-brand-accent uppercase tracking-widest", children: day.dayLabel }), _jsxs("span", { className: "text-xs text-white/40 ml-1", children: ["\u2014 ", day.focus] })] }), _jsx("div", { className: "flex flex-col gap-2", children: day.exercises.map((ex) => (_jsxs("div", { className: "flex items-center gap-2.5 py-1", children: [_jsx("span", { className: "text-base w-6 text-center", children: getExerciseIcon(ex.exerciseId) }), _jsx("span", { className: "text-sm text-white/80 flex-1", children: getExerciseLabel(ex.exerciseId) }), _jsxs("span", { className: "text-xs text-white/40 shrink-0", children: [ex.sets, " \u00D7", " ", ex.exerciseId === "plank"
                                                        ? `${ex.reps}s`
                                                        : `${ex.reps} reps`] })] }, ex.exerciseId))) })] }, day.dayLabel))) }), _jsxs("button", { onClick: handleConfirm, className: "mt-2 flex items-center justify-center gap-2 w-full py-4 rounded-2xl bg-gradient-accent text-brand-bg font-bold text-base shadow-glow-accent transition-smooth active:scale-95", children: [_jsx(Check, { size: 18 }), "Looks great, start training!"] })] }))] }));
}
