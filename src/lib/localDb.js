import { openDB } from "idb";
const DB_NAME = "formguard-db";
const DB_VERSION = 2;
let dbPromise = null;
function normalizeStorageError(error) {
    if (error instanceof DOMException && error.name === "QuotaExceededError") {
        return new Error("Local storage is full. Clear site data or remove older sessions, then try saving again.");
    }
    return error instanceof Error ? error : new Error("Could not write workout data to local storage.");
}
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
                // Trainee profile store (v2)
                if (!db.objectStoreNames.contains("trainee_profile")) {
                    db.createObjectStore("trainee_profile", { keyPath: "id" });
                }
                // Training plans store (v2)
                if (!db.objectStoreNames.contains("training_plans")) {
                    db.createObjectStore("training_plans", { keyPath: "id" });
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
    try {
        await db.put("sessions", record);
    }
    catch (error) {
        throw normalizeStorageError(error);
    }
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
        try {
            await db.put("prs", { ...pr, key });
        }
        catch (error) {
            throw normalizeStorageError(error);
        }
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
// ─── Trainee profile ─────────────────────────────────────────────────────────
/** Save (or overwrite) the trainee's profile. Uses a fixed id "current". */
export async function saveTraineeProfile(profile) {
    const db = await getDb();
    await db.put("trainee_profile", { ...profile, id: "current" });
}
/** Get the stored trainee profile, or undefined if none exists. */
export async function getTraineeProfile() {
    const db = await getDb();
    return db.get("trainee_profile", "current");
}
// ─── Training plans ───────────────────────────────────────────────────────────
/** Save (or update) a training plan. */
export async function saveTrainingPlan(plan) {
    const db = await getDb();
    await db.put("training_plans", plan);
}
/** Get the currently active training plan, or undefined if none exists. */
export async function getActiveTrainingPlan() {
    const db = await getDb();
    const all = await db.getAll("training_plans");
    return all.find((p) => p.active);
}
/** Deactivate a training plan by id. */
export async function deactivatePlan(id) {
    const db = await getDb();
    const plan = await db.get("training_plans", id);
    if (plan)
        await db.put("training_plans", { ...plan, active: false });
}
