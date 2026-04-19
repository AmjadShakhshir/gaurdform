import { useEffect, useRef, useState, useCallback } from "react";
import { saveSessionLocally, getAllSessions, getUnsyncedSessions, markSessionSynced, getPRs, } from "../lib/localDb";
import { computeStreak } from "../lib/streaks";
import { detectAndSavePRs } from "../lib/personalRecords";
import { logSession, getSupabase, supabaseEnabled } from "../lib/supabase";
const DEFAULT_STREAK = {
    currentStreak: 0,
    longestStreak: 0,
    lastActiveDate: null,
    isActiveToday: false,
};
export function useTraineeData() {
    const [isLoading, setIsLoading] = useState(true);
    const [sessions, setSessions] = useState([]);
    const [prs, setPrs] = useState([]);
    const [streakInfo, setStreakInfo] = useState(DEFAULT_STREAK);
    const syncInFlight = useRef(false);
    const load = useCallback(async () => {
        const [allSessions, allPRs] = await Promise.all([getAllSessions(), getPRs()]);
        setSessions(allSessions);
        setPrs(allPRs);
        setStreakInfo(computeStreak(allSessions));
    }, []);
    const syncPendingSessions = useCallback(async () => {
        if (!supabaseEnabled || syncInFlight.current)
            return;
        syncInFlight.current = true;
        try {
            const unsynced = await getUnsyncedSessions();
            let syncedCount = 0;
            for (const session of unsynced) {
                try {
                    const synced = await logSession(session);
                    if (!synced)
                        break;
                    await markSessionSynced(session.id);
                    syncedCount += 1;
                }
                catch {
                    break;
                }
            }
            if (syncedCount > 0)
                await load();
        }
        finally {
            syncInFlight.current = false;
        }
    }, [load]);
    // Initial load
    useEffect(() => {
        load().finally(() => setIsLoading(false));
    }, [load]);
    // Listen for Supabase auth changes → sync unsynced sessions
    useEffect(() => {
        if (!supabaseEnabled)
            return;
        const sb = getSupabase();
        if (!sb)
            return;
        const { data: { subscription } } = sb.auth.onAuthStateChange((_event, session) => {
            if (session?.user) {
                void syncPendingSessions();
            }
        });
        return () => { subscription.unsubscribe(); };
    }, [syncPendingSessions]);
    useEffect(() => {
        if (!supabaseEnabled || typeof window === "undefined")
            return;
        const handleOnline = () => { void syncPendingSessions(); };
        window.addEventListener("online", handleOnline);
        if (window.navigator.onLine) {
            void syncPendingSessions();
        }
        return () => {
            window.removeEventListener("online", handleOnline);
        };
    }, [syncPendingSessions]);
    const saveSession = useCallback(async (args) => {
        // Write to IndexedDB first (works offline)
        const saved = await saveSessionLocally({
            ...args,
            created_at: new Date().toISOString(),
        });
        // Detect and persist PRs
        const newPRs = await detectAndSavePRs(args.exercise, saved);
        // Optimistically sync to Supabase
        try {
            const synced = await logSession(saved);
            if (synced) {
                await markSessionSynced(saved.id);
            }
        }
        catch {
            // Stays unsynced locally — will retry on next auth change
        }
        // Refresh state
        await load();
        return newPRs;
    }, [load]);
    return { isLoading, sessions, prs, streakInfo, saveSession, reload: load };
}
