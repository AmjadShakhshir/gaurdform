import { useEffect, useState } from "react";
import { Trophy, LogOut, Mail } from "lucide-react";
import { getSupabase, supabaseEnabled } from "../lib/supabase";
import type { LocalSession, PersonalRecord } from "../lib/localDb";
import { EXERCISES } from "../exercises";

interface HistoryPanelProps {
  sessions: LocalSession[];
  prs: PersonalRecord[];
}

function exerciseLabel(id: string): string {
  return EXERCISES.find((e) => e.id === id)?.label ?? id;
}

function isPRSession(sessionId: string, prs: PersonalRecord[]): boolean {
  return prs.some((pr) => pr.sessionId === sessionId);
}

export function HistoryPanel({ sessions, prs }: HistoryPanelProps) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [user, setUser] = useState<string | null>(null);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    sb.auth.getUser().then(({ data }) => {
      if (data.user) setUser(data.user.email ?? "signed in");
    });
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user?.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn = async () => {
    const sb = getSupabase();
    if (!sb) return;
    await sb.auth.signInWithOtp({ email });
    setSent(true);
  };

  const signOut = async () => {
    const sb = getSupabase();
    if (!sb) return;
    await sb.auth.signOut();
    setUser(null);
  };

  return (
    <div className="space-y-3">
      {/* Auth section */}
      {supabaseEnabled && (
        <div className="rounded-2xl glass-card p-3">
          {user ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Mail size={13} className="text-slate-400" />
                <span className="text-xs text-slate-400 truncate">{user}</span>
              </div>
              <button onClick={signOut} className="flex items-center gap-1 text-xs text-slate-400 hover:text-white ml-2 shrink-0 transition-smooth">
                <LogOut size={11} />Sign out
              </button>
            </div>
          ) : !sent ? (
            <div className="flex gap-2">
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1 px-3 py-1.5 rounded-xl glass-surface ring-1 ring-white/10 text-sm bg-transparent focus:ring-brand-accent/50 focus:outline-none"
              />
              <button
                onClick={signIn}
                disabled={!email.includes("@")}
                className="px-3 py-1.5 rounded-xl bg-gradient-accent text-white text-xs font-semibold disabled:opacity-40 shadow-glow-accent-sm"
              >
                Magic link
              </button>
            </div>
          ) : (
            <p className="text-xs text-slate-400">Check your email for a sign-in link.</p>
          )}
        </div>
      )}

      {/* Sessions list — always shows from local IndexedDB */}
      <div className="rounded-2xl glass-card p-3 space-y-2">
        <h3 className="font-semibold text-slate-100 text-sm">Recent Sessions</h3>
        {sessions.length === 0 ? (
          <p className="text-xs text-slate-400">No sessions yet — finish a set to log one.</p>
        ) : (
          <ul className="space-y-1.5 max-h-64 overflow-y-auto">
            {sessions.map((s, i) => {
              const hasPR = isPRSession(s.id, prs);
              return (
                <li
                  key={s.id}
                  className={`flex justify-between items-center text-sm glass-surface rounded-xl px-3 py-2 animate-slide-up stagger-${Math.min(i + 1, 6)}`}
                >
                  <div className="flex items-center gap-1.5">
                    {hasPR && <Trophy size={14} className="text-amber-400" aria-label="Personal Record" />}
                    <span className="font-medium text-white">{exerciseLabel(s.exercise)}</span>
                  </div>
                  <span className="text-slate-400 text-xs">
                    {s.reps} reps · {new Date(s.created_at ?? "").toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
