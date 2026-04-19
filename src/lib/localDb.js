import { openDB } from "idb";
const DB_NAME = "formguard-db";
const DB_VERSION = 1;
let dbPromise = null;
function getDb() {
    if (!dbPromise) {
        dbPromise = openDB(DB_NAME, DB_VERSION, {
            upgrade(db) {
                // Sessions store
                if (!db.objectStoreNames.contains("sessions")) {
                    const sessStore = db.createObjectStore("sessions", { keyPath: "id" });
                    sessStore.createIndex("by_exercise", "exercise");
                    sessStore.createIndex("by_created_at", "created_at");
                    sessStore.createIndex("by_synced", "synced");
                }
                // PRs store
                if (!db.objectStoreNames.contains("prs")) {
                    const prStore = db.createObjectStore("prs", { keyPath: "key" });
                    prStore.createIndex("by_exercise", "exerciseId");
                }
            },
        });
    }
    return dbPromise;
}
/** Save a session locally. Generates an id if not provided. */
export async function saveSessionLocally(session) {
    const db = await getDb();
    const id = session.id ?? crypto.randomUUID();
    const record = { ...session, id, synced: false };
    await db.put("sessions", record);
    return record;
}
/** Mark a session as synced to Supabase. */
export async function markSessionSynced(id) {
    const db = await getDb();
    const record = await db.get("sessions", id);
    if (record)
        await db.put("sessions", { ...record, synced: true });
}
/** Get all sessions, newest first. */
export async function getAllSessions() {
    const db = await getDb();
    const all = await db.getAll("sessions");
    return all.sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
}
/** Get sessions for a specific exercise. */
export async function getSessionsByExercise(exerciseId) {
    const db = await getDb();
    const all = await db.getAllFromIndex("sessions", "by_exercise", exerciseId);
    return all.sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
}
/** Get all unsynced sessions. */
export async function getUnsyncedSessions() {
    const db = await getDb();
    return db.getAllFromIndex("sessions", "by_synced", 0);
}
/** Save or update a personal record. Returns true if it is a new PR. */
export async function savePR(pr) {
    const db = await getDb();
    const key = `${pr.exerciseId}::${pr.metric}`;
    const existing = await db.get("prs", key);
    const isNewPR = !existing || pr.value > existing.value;
    if (isNewPR) {
        await db.put("prs", { ...pr, key });
    }
    return isNewPR;
}
/** Get all PRs, optionally filtered by exercise. */
export async function getPRs(exerciseId) {
    const db = await getDb();
    if (exerciseId) {
        return db.getAllFromIndex("prs", "by_exercise", exerciseId);
    }
    return db.getAll("prs");
}
/** Get a single PR by exercise + metric. */
export async function getPR(exerciseId, metric) {
    const db = await getDb();
    return db.get("prs", `${exerciseId}::${metric}`);
}
