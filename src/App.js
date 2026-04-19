import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useRef, useState, useEffect } from "react";
import { Shield, Timer, Coffee, Square, Dumbbell } from "lucide-react";
import { EXERCISES } from "./exercises/index";
import { useExerciseSession } from "./hooks/useExerciseSession";
import { useIsMobile } from "./hooks/useIsMobile";
import { useTraineeData } from "./hooks/useTraineeData";
import { CameraView } from "./components/CameraView";
import { FeedbackChips } from "./components/FeedbackChips";
import { RepCounter } from "./components/RepCounter";
import { ExerciseSelector } from "./components/ExerciseSelector";
import { CoachReview } from "./components/CoachReview";
import { HistoryPanel } from "./components/HistoryPanel";
import { BottomSheet } from "./components/BottomSheet";
import { StreakBadge } from "./components/StreakBadge";
import { PRCelebration } from "./components/PRCelebration";
import { ProgressPanel } from "./components/ProgressPanel";
export default function App() {
    const exercises = EXERCISES;
    const [selected, setSelected] = useState(exercises[0]);
    const videoRef = useRef(null);
    const sessionStartRef = useRef(Date.now());
    const { status, statusMsg, state, activeFeedback, landmarks, viewAngle, setComplete, fps, start, stop } = useExerciseSession(selected, videoRef);
    const isMobile = useIsMobile();
    const traineeData = useTraineeData();
    const [pendingPRs, setPendingPRs] = useState([]);
    const [sessionElapsed, setSessionElapsed] = useState(0);
    const [restSecondsLeft, setRestSecondsLeft] = useState(null);
    function formatSec(sec) {
        const m = Math.floor(sec / 60).toString().padStart(2, "0");
        const s = (sec % 60).toString().padStart(2, "0");
        return `${m}:${s}`;
    }
    // Track session start time
    useEffect(() => {
        if (status === "ready")
            sessionStartRef.current = Date.now();
    }, [status]);
    // Session elapsed timer — counts up while running
    useEffect(() => {
        if (status !== "ready") {
            setSessionElapsed(0);
            return;
        }
        const id = setInterval(() => setSessionElapsed((s) => s + 1), 1000);
        return () => clearInterval(id);
    }, [status]);
    // Rest timer — counts down after a set ends
    useEffect(() => {
        if (restSecondsLeft === null)
            return;
        if (restSecondsLeft <= 0) {
            setRestSecondsLeft(null);
            return;
        }
        const id = setTimeout(() => setRestSecondsLeft((s) => (s ?? 1) - 1), 1000);
        return () => clearTimeout(id);
    }, [restSecondsLeft]);
    // Save session and detect PRs when user stops
    const endSession = async () => {
        if (state.reps > 0) {
            const durationSec = Math.round((Date.now() - sessionStartRef.current) / 1000);
            const scores = state.repLog.map((r) => r.metrics.score ?? 0).filter((v) => v > 0);
            const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
            const bestScore = scores.length > 0 ? Math.max(...scores) : null;
            const newPRs = await traineeData.saveSession({
                exercise: selected.id,
                reps: state.reps,
                avg_metric: avgScore !== null ? Number(avgScore.toFixed(1)) : null,
                best_score: bestScore !== null ? Number(bestScore.toFixed(1)) : null,
                session_duration_sec: durationSec,
                metrics_json: state.repLog.length > 0 ? state.repLog : null,
            });
            if (newPRs.length > 0)
                setPendingPRs(newPRs);
        }
        stop();
        setRestSecondsLeft(60);
    };
    useEffect(() => {
        // Cleanup on exercise change while running
        if (status === "ready")
            stop();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selected]);
    const ctaLabel = status === "idle"
        ? "Start"
        : status === "loading"
            ? statusMsg || "Loading…"
            : status === "ready"
                ? "Stop & save"
                : "Retry";
    const coachPanel = (_jsx(CoachReview, { exercise: selected.id, state: state, autoTrigger: setComplete, viewAngle: viewAngle }));
    const progressPanel = (_jsx(ProgressPanel, { sessions: traineeData.sessions, prs: traineeData.prs }));
    const historyPanel = (_jsx(HistoryPanel, { sessions: traineeData.sessions, prs: traineeData.prs }));
    const counterTarget = selected.targetCount ?? 10;
    const counterUnit = selected.counterUnit ?? "reps";
    const counterValue = selected.id === "plank"
        ? Math.min(counterTarget, state.phase === "HOLDING" ? state.scratch.holdSec ?? 0 : state.reps)
        : state.reps;
    return (
    /* Mobile: fullscreen fixed viewport. Desktop: normal scrollable page */
    _jsxs("div", { className: "relative overflow-hidden h-[100dvh] md:h-auto md:overflow-visible md:min-h-screen md:max-w-5xl md:mx-auto md:px-4 md:py-6 md:space-y-6 bg-brand-bg", children: [_jsxs("header", { className: "hidden md:flex items-center justify-between", children: [_jsxs("div", { children: [_jsxs("h1", { className: "text-2xl md:text-3xl font-bold flex items-center gap-2", children: [_jsx(Shield, { size: 28, className: "text-brand-accent" }), _jsx("span", { className: "text-gradient-brand", children: "FormGuard" }), _jsx("span", { className: "text-slate-400 font-normal text-base ml-1", children: "AI trainer in your browser" })] }), _jsx("p", { className: "text-xs text-slate-500 mt-1", children: "Pose runs on-device via MediaPipe. Your video never leaves this page." })] }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsx(StreakBadge, { streakInfo: traineeData.streakInfo }), _jsx(ExerciseSelector, { selected: selected, onSelect: setSelected, disabled: status === "loading" })] })] }), status === "idle" && (_jsxs("div", { className: "hidden md:flex items-center gap-3 glass-card rounded-xl p-4 text-sm text-slate-300 animate-slide-up", children: [_jsx(Dumbbell, { size: 16, className: "text-brand-accent shrink-0" }), _jsxs("span", { children: [_jsx("span", { className: "font-semibold text-brand-accent", children: "Setup:" }), " ", selected.setupTip] })] })), _jsxs("div", { className: "absolute inset-0 md:relative md:inset-auto", children: [_jsx(CameraView, { videoRef: videoRef, landmarks: landmarks, mirrored: true, viewAngle: viewAngle, supportedViews: selected.supportedViews }), _jsx("div", { className: "md:hidden absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-black/50 to-transparent pointer-events-none z-[1]" }), status !== "ready" && (_jsx("div", { className: "absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/50 backdrop-blur-[2px] md:rounded-2xl", children: restSecondsLeft !== null ? (_jsx("div", { className: "md:hidden flex flex-col items-center gap-4 animate-scale-in", children: _jsxs("div", { className: "glass-card rounded-2xl px-8 py-6 flex flex-col items-center gap-3", children: [_jsxs("div", { className: "flex items-center gap-2 text-slate-300", children: [_jsx(Coffee, { size: 16 }), _jsx("span", { className: "text-sm font-semibold uppercase tracking-widest", children: "Rest" })] }), _jsxs("div", { className: "relative w-24 h-24", children: [_jsxs("svg", { className: "absolute inset-0 -rotate-90", width: "96", height: "96", children: [_jsx("circle", { cx: "48", cy: "48", r: "40", fill: "none", stroke: "rgba(30,41,59,0.8)", strokeWidth: "6" }), _jsx("circle", { cx: "48", cy: "48", r: "40", fill: "none", stroke: "#a78bfa", strokeWidth: "6", strokeLinecap: "round", strokeDasharray: `${2 * Math.PI * 40}`, strokeDashoffset: `${2 * Math.PI * 40 * (1 - restSecondsLeft / 60)}`, style: { transition: "stroke-dashoffset 0.9s linear", filter: "drop-shadow(0 0 8px rgba(167,139,250,0.7))" } })] }), _jsx("div", { className: "absolute inset-0 flex items-center justify-center", children: _jsx("span", { className: "text-3xl font-bold tabular-nums text-white font-mono", children: restSecondsLeft }) })] }), _jsx("button", { onClick: () => setRestSecondsLeft(null), className: "px-5 py-1.5 rounded-full glass-card text-white/70 text-sm hover:text-white transition-smooth", children: "Skip" })] }) })) : (_jsxs(_Fragment, { children: [_jsx("button", { onClick: start, disabled: status === "loading", className: "px-8 py-4 rounded-2xl bg-gradient-accent text-white font-bold text-lg shadow-glow-accent hover:shadow-glow-accent transition-smooth disabled:opacity-60 animate-scale-in", children: ctaLabel }), status === "idle" && (_jsxs("div", { className: "md:hidden glass-card rounded-xl p-3 text-center text-sm text-slate-300 max-w-xs mx-4 animate-fade-in", children: [_jsx("span", { className: "font-semibold text-brand-accent", children: "Setup:" }), " ", selected.setupTip] }))] })) })), status === "ready" && (_jsx("div", { className: "absolute top-12 md:top-4 inset-x-0 px-4", children: _jsx(FeedbackChips, { items: activeFeedback }) })), _jsxs("div", { className: "md:hidden absolute top-0 inset-x-0 flex justify-between items-start pt-safe-top px-4 z-10 pointer-events-none", children: [_jsx("div", { className: "pointer-events-auto mt-1", children: _jsx(StreakBadge, { streakInfo: traineeData.streakInfo }) }), _jsx("div", { className: "pointer-events-auto", children: _jsx(ExerciseSelector, { selected: selected, onSelect: setSelected, disabled: status === "loading", compact: true }) })] }), status === "ready" && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "md:hidden absolute bottom-24 left-4 z-10 flex flex-col gap-2", children: [_jsx("div", { className: "glass-dark rounded-xl p-2", children: _jsx(RepCounter, { state: state, compact: true, targetCount: counterTarget, valueOverride: counterValue, counterUnit: counterUnit }) }), _jsxs("div", { className: "glass-dark rounded-lg px-3 py-1 flex items-center gap-1.5", children: [_jsx(Timer, { size: 11, className: "text-brand-accent" }), _jsx("span", { className: "text-xs text-slate-300 tabular-nums font-mono", children: formatSec(sessionElapsed) })] })] }), _jsxs("div", { className: "md:hidden absolute bottom-24 right-4 z-10 flex flex-col items-end gap-2", children: [fps > 0 && (_jsxs("span", { className: "text-xs text-white/50 tabular-nums glass-dark px-2 py-0.5 rounded-md", children: [fps, " fps"] })), _jsxs("button", { onClick: endSession, className: "flex items-center gap-2 px-4 py-2 rounded-xl glass-card border-red-500/30 text-red-300 font-semibold text-sm shadow-glow-err hover:text-red-200 transition-smooth", children: [_jsx(Square, { size: 14, fill: "currentColor" }), "Stop"] })] })] }))] }), _jsxs("div", { className: "hidden md:flex items-center justify-between gap-4 flex-wrap glass-card rounded-2xl p-4", children: [_jsx(RepCounter, { state: state, targetCount: counterTarget, valueOverride: counterValue, counterUnit: counterUnit }), _jsxs("div", { className: "flex items-center gap-3", children: [fps > 0 && status === "ready" && (_jsxs("span", { className: "text-xs text-slate-500 tabular-nums", children: [fps, " fps"] })), status === "ready" && (_jsxs("div", { className: "flex items-center gap-2", children: [_jsxs("div", { className: "flex items-center gap-1.5 glass-dark rounded-lg px-3 py-1.5", children: [_jsx(Timer, { size: 13, className: "text-brand-accent" }), _jsx("span", { className: "text-sm tabular-nums font-mono text-slate-300", children: formatSec(sessionElapsed) })] }), _jsxs("button", { onClick: endSession, className: "flex items-center gap-2 px-5 py-2 rounded-xl glass-card border-red-500/30 text-red-300 font-semibold shadow-glow-err hover:text-red-200 transition-smooth", children: [_jsx(Square, { size: 14, fill: "currentColor" }), "Stop & save"] })] }))] })] }), status === "error" && (_jsxs("div", { className: "hidden md:block rounded-xl bg-brand-err/20 ring-1 ring-brand-err/50 p-4 text-sm", children: [_jsx("strong", { children: "Error:" }), " ", statusMsg] })), status === "error" && (_jsx("div", { className: "md:hidden absolute top-16 inset-x-0 px-4 z-10", children: _jsxs("div", { className: "rounded-xl bg-brand-err/90 backdrop-blur-sm p-3 text-sm text-white", children: [_jsx("strong", { children: "Error:" }), " ", statusMsg] }) })), !isMobile && (_jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsx("div", { className: "glass-card rounded-2xl p-4 animate-slide-up stagger-1", children: coachPanel }), _jsxs("div", { className: "space-y-4", children: [_jsx("div", { className: "glass-card rounded-2xl p-4 animate-slide-up stagger-2", children: progressPanel }), _jsx("div", { className: "glass-card rounded-2xl p-4 animate-slide-up stagger-3", children: historyPanel })] })] })), isMobile && (_jsx(BottomSheet, { coachContent: coachPanel, progressContent: progressPanel, historyContent: historyPanel })), pendingPRs.length > 0 && (_jsx(PRCelebration, { prs: pendingPRs, onDismiss: () => setPendingPRs([]) })), _jsxs("footer", { className: "hidden md:block pt-6 border-t border-white/5 text-xs text-slate-500 space-y-1", children: [_jsxs("p", { children: [_jsx("strong", { className: "text-slate-300", children: "Privacy:" }), " Pose estimation runs in your browser. No frames, images, or landmark coordinates are ever sent to a server. Optional coach review sends only numeric per-rep summaries."] }), _jsxs("p", { children: [_jsx("strong", { className: "text-slate-300", children: "Install:" }), " Tap the browser menu \u2192 \"Add to Home Screen\" to use FormGuard offline."] })] })] }));
}
