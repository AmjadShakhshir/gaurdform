import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { Trophy, LogOut, Mail } from "lucide-react";
import { getSupabase, supabaseEnabled } from "../lib/supabase";
import { EXERCISES } from "../exercises";
function exerciseLabel(id) {
    return EXERCISES.find((e) => e.id === id)?.label ?? id;
}
function isPRSession(sessionId, prs) {
    return prs.some((pr) => pr.sessionId === sessionId);
}
export function HistoryPanel({ sessions, prs }) {
    const [email, setEmail] = useState("");
    const [sent, setSent] = useState(false);
    const [user, setUser] = useState(null);
    useEffect(() => {
        const sb = getSupabase();
        if (!sb)
            return;
        sb.auth.getUser().then(({ data }) => {
            if (data.user)
                setUser(data.user.email ?? "signed in");
        });
        const { data: sub } = sb.auth.onAuthStateChange((_e, session) => {
            setUser(session?.user?.email ?? null);
        });
        return () => sub.subscription.unsubscribe();
    }, []);
    const signIn = async () => {
        const sb = getSupabase();
        if (!sb)
            return;
        await sb.auth.signInWithOtp({ email });
        setSent(true);
    };
    const signOut = async () => {
        const sb = getSupabase();
        if (!sb)
            return;
        await sb.auth.signOut();
        setUser(null);
    };
    return (_jsxs("div", { className: "space-y-3", children: [supabaseEnabled && (_jsx("div", { className: "rounded-2xl glass-card p-3", children: user ? (_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx(Mail, { size: 13, className: "text-slate-400" }), _jsx("span", { className: "text-xs text-slate-400 truncate", children: user })] }), _jsxs("button", { onClick: signOut, className: "flex items-center gap-1 text-xs text-slate-400 hover:text-white ml-2 shrink-0 transition-smooth", children: [_jsx(LogOut, { size: 11 }), "Sign out"] })] })) : !sent ? (_jsxs("div", { className: "flex gap-2", children: [_jsx("input", { type: "email", placeholder: "you@example.com", value: email, onChange: (e) => setEmail(e.target.value), className: "flex-1 px-3 py-1.5 rounded-xl glass-surface ring-1 ring-white/10 text-sm bg-transparent focus:ring-brand-accent/50 focus:outline-none" }), _jsx("button", { onClick: signIn, disabled: !email.includes("@"), className: "px-3 py-1.5 rounded-xl bg-gradient-accent text-white text-xs font-semibold disabled:opacity-40 shadow-glow-accent-sm", children: "Magic link" })] })) : (_jsx("p", { className: "text-xs text-slate-400", children: "Check your email for a sign-in link." })) })), _jsxs("div", { className: "rounded-2xl glass-card p-3 space-y-2", children: [_jsx("h3", { className: "font-semibold text-slate-100 text-sm", children: "Recent Sessions" }), sessions.length === 0 ? (_jsx("p", { className: "text-xs text-slate-400", children: "No sessions yet \u2014 finish a set to log one." })) : (_jsx("ul", { className: "space-y-1.5 max-h-64 overflow-y-auto", children: sessions.map((s, i) => {
                            const hasPR = isPRSession(s.id, prs);
                            return (_jsxs("li", { className: `flex justify-between items-center text-sm glass-surface rounded-xl px-3 py-2 animate-slide-up stagger-${Math.min(i + 1, 6)}`, children: [_jsxs("div", { className: "flex items-center gap-1.5", children: [hasPR && _jsx(Trophy, { size: 14, className: "text-amber-400", "aria-label": "Personal Record" }), _jsx("span", { className: "font-medium text-white", children: exerciseLabel(s.exercise) })] }), _jsxs("span", { className: "text-slate-400 text-xs", children: [s.reps, " reps \u00B7 ", new Date(s.created_at ?? "").toLocaleDateString(undefined, { month: "short", day: "numeric" })] })] }, s.id));
                        }) }))] })] }));
}
