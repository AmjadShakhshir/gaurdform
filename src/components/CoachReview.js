import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useRef } from "react";
import { Brain, Loader2 } from "lucide-react";
import { coachReview, geminiEnabled } from "../lib/gemini";
function localSummary(reps) {
    if (reps.length === 0)
        return "No reps to summarize.";
    const scores = reps.map((r) => r.metrics.score ?? 0);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const best = reps.reduce((b, r) => (r.metrics.score ?? 0) >= (b.metrics.score ?? 0) ? r : b);
    const worst = reps.reduce((w, r) => (r.metrics.score ?? 0) <= (w.metrics.score ?? 0) ? r : w);
    return `Set summary: avg ${Math.round(avg)}/100 across ${reps.length} reps. Best was rep ${best.repIndex} (${best.metrics.score}/100), most room to improve on rep ${worst.repIndex} (${worst.metrics.score}/100).`;
}
export function CoachReview({ exercise, state, autoTrigger, viewAngle }) {
    const [loading, setLoading] = useState(false);
    const [response, setResponse] = useState(null);
    const autoTriggeredRef = useRef(false);
    const onReview = async () => {
        if (loading)
            return;
        setLoading(true);
        setResponse(null);
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 12_000);
            const text = await coachReview(exercise, state.repLog, controller.signal, viewAngle);
            clearTimeout(timeoutId);
            setResponse(text);
        }
        catch (err) {
            // Fallback: local summary when Gemini is unavailable or timed out.
            const isRateLimit = err instanceof Error && err.message.includes("rate limited");
            const prefix = geminiEnabled
                ? isRateLimit
                    ? "Gemini is rate-limited right now. "
                    : "Coach offline. "
                : "";
            setResponse(prefix + localSummary(state.repLog));
        }
        finally {
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
    return (_jsxs("div", { className: "rounded-2xl glass-card p-4 space-y-3", children: [_jsxs("div", { className: "flex items-center justify-between gap-3", children: [_jsxs("div", { children: [_jsxs("h3", { className: "font-semibold text-slate-100 flex items-center gap-2", children: [_jsx(Brain, { size: 18, className: "text-brand-accent" }), "AI Coach Review"] }), _jsx("p", { className: "text-xs text-slate-400 mt-0.5", children: geminiEnabled
                                    ? "Sends only numeric metrics — never video."
                                    : "Add VITE_GEMINI_API_KEY in .env to enable AI review." })] }), _jsxs("button", { onClick: onReview, disabled: loading || state.reps === 0, className: "flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-accent text-white font-semibold text-sm disabled:opacity-40 shadow-glow-accent-sm hover:shadow-glow-accent transition-smooth", children: [loading ? _jsx(Loader2, { size: 14, className: "animate-spin" }) : null, loading ? "Thinking…" : `Review ${state.reps} reps`] })] }), response && (_jsx("p", { className: "text-sm text-slate-200 leading-relaxed border-l-2 border-brand-accent pl-3 animate-fade-in", children: response }))] }));
}
