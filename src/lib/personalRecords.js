import { getPR, savePR } from "./localDb";
const EXERCISE_PR_METRICS = {
    squat: [
        { metric: "score", label: "Best Form Score", unit: "/100" },
        { metric: "minKneeAngle", label: "Deepest Squat", unit: "°", invertForComparison: true },
    ],
    pushUp: [
        { metric: "score", label: "Best Form Score", unit: "/100" },
    ],
    plank: [
        { metric: "score", label: "Best Form Score", unit: "/100" },
        { metric: "holdSec", label: "Longest Hold", unit: "s" },
    ],
    bicepCurl: [
        { metric: "score", label: "Best Form Score", unit: "/100" },
        { metric: "minElbowAngle", label: "Best ROM", unit: "°", invertForComparison: true },
    ],
    lunge: [
        { metric: "score", label: "Best Form Score", unit: "/100" },
    ],
    rdl: [
        { metric: "score", label: "Best Form Score", unit: "/100" },
    ],
    bulgarianSplitSquat: [
        { metric: "score", label: "Best Form Score", unit: "/100" },
    ],
    legPress: [
        { metric: "score", label: "Best Form Score", unit: "/100" },
    ],
    calfRaise: [
        { metric: "score", label: "Best Form Score", unit: "/100" },
    ],
    overheadPress: [
        { metric: "score", label: "Best Form Score", unit: "/100" },
    ],
    deadlift: [
        { metric: "score", label: "Best Form Score", unit: "/100" },
    ],
    bentOverRow: [
        { metric: "score", label: "Best Form Score", unit: "/100" },
    ],
};
/** Universal session-level PR metrics (every exercise). */
const UNIVERSAL_SESSION_PRS = [
    { metric: "mostReps", label: "Most Reps", unit: " reps", sessionLevel: true },
    { metric: "avgScore", label: "Best Avg Score", unit: "/100", sessionLevel: true },
];
/**
 * Detect new PRs for a completed session and persist them.
 * Returns the list of newly broken PRs for the celebration UI.
 */
export async function detectAndSavePRs(exerciseId, session) {
    const newPRs = [];
    const date = session.created_at?.slice(0, 10) ?? new Date().toISOString().slice(0, 10);
    // Per-rep PR metrics
    const repMetrics = EXERCISE_PR_METRICS[exerciseId] ?? [];
    for (const def of repMetrics) {
        if (!session.metrics_json?.length)
            continue;
        const rawValues = session.metrics_json.map((r) => r.metrics[def.metric] ?? -Infinity);
        const rawBest = def.invertForComparison
            ? Math.min(...rawValues.filter((v) => v > -Infinity))
            : Math.max(...rawValues.filter((v) => v > -Infinity));
        if (!isFinite(rawBest))
            continue;
        // For comparison: invert if needed so "higher = better"
        const compValue = def.invertForComparison ? 180 - rawBest : rawBest;
        const existing = await getPR(exerciseId, def.metric);
        const existingComp = existing
            ? (def.invertForComparison ? 180 - existing.value : existing.value)
            : -Infinity;
        if (compValue > existingComp) {
            const pr = {
                exerciseId,
                metric: def.metric,
                label: def.label,
                value: rawBest, // store raw display value
                sessionId: session.id,
                date,
            };
            await savePR(pr);
            newPRs.push({
                metric: def.metric,
                label: def.label,
                unit: def.unit,
                previousValue: existing?.value ?? null,
                newValue: rawBest,
                invertForComparison: def.invertForComparison,
            });
        }
    }
    // Session-level PRs
    for (const def of UNIVERSAL_SESSION_PRS) {
        let candidateValue;
        if (def.metric === "mostReps") {
            candidateValue = session.reps;
        }
        else if (def.metric === "avgScore") {
            candidateValue = session.avg_metric ?? 0;
        }
        else {
            continue;
        }
        if (candidateValue <= 0)
            continue;
        const existing = await getPR(exerciseId, def.metric);
        if (!existing || candidateValue > existing.value) {
            const pr = {
                exerciseId,
                metric: def.metric,
                label: def.label,
                value: candidateValue,
                sessionId: session.id,
                date,
            };
            await savePR(pr);
            newPRs.push({
                metric: def.metric,
                label: def.label,
                unit: def.unit,
                previousValue: existing?.value ?? null,
                newValue: candidateValue,
            });
        }
    }
    return newPRs;
}
export { EXERCISE_PR_METRICS, UNIVERSAL_SESSION_PRS };
