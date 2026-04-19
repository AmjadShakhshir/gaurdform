function toLocalDate(dateStr) {
    return new Date(dateStr).toLocaleDateString("sv");
}
function daysAgo(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toLocaleDateString("sv");
}
/**
 * Simple linear regression — returns slope (change per point).
 */
function linearRegressionSlope(values) {
    const n = values.length;
    if (n < 2)
        return 0;
    const xs = values.map((_, i) => i);
    const xMean = xs.reduce((a, b) => a + b, 0) / n;
    const yMean = values.reduce((a, b) => a + b, 0) / n;
    const num = xs.reduce((acc, x, i) => acc + (x - xMean) * (values[i] - yMean), 0);
    const den = xs.reduce((acc, x) => acc + (x - xMean) ** 2, 0);
    return den === 0 ? 0 : num / den;
}
/**
 * Aggregate session data into daily progress points for charting.
 */
export function getProgressData(exerciseId, sessions, range) {
    const rangeDays = range === "7d" ? 7 : range === "30d" ? 30 : 90;
    const cutoff = daysAgo(rangeDays);
    const relevant = sessions.filter((s) => s.exercise === exerciseId &&
        s.created_at &&
        toLocalDate(s.created_at) >= cutoff);
    // Group by day
    const byDay = new Map();
    for (const s of relevant) {
        const date = toLocalDate(s.created_at);
        if (!byDay.has(date))
            byDay.set(date, { scores: [], reps: 0 });
        const entry = byDay.get(date);
        if (s.avg_metric != null && s.avg_metric > 0)
            entry.scores.push(s.avg_metric);
        entry.reps += s.reps;
    }
    // Build sorted points
    const points = Array.from(byDay.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, { scores, reps }]) => ({
        date,
        avgScore: scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0,
        bestScore: scores.length > 0 ? Math.max(...scores) : 0,
        totalReps: reps,
        sessionCount: relevant.filter((s) => toLocalDate(s.created_at) === date).length,
    }));
    const totalSessions = relevant.length;
    const totalReps = relevant.reduce((sum, s) => sum + s.reps, 0);
    // Trend: linear regression slope over avg scores, expressed as % change
    const avgScores = points.map((p) => p.avgScore).filter((v) => v > 0);
    let trendPercent = null;
    if (avgScores.length >= 3) {
        const slope = linearRegressionSlope(avgScores);
        const baseline = avgScores[0];
        trendPercent = baseline > 0 ? Math.round((slope * (avgScores.length - 1) * 100) / baseline) : null;
    }
    const firstScore = avgScores[0] ?? null;
    const latestScore = avgScores[avgScores.length - 1] ?? null;
    return { points, totalSessions, totalReps, trendPercent, firstScore, latestScore };
}
