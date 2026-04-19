const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
export const geminiEnabled = Boolean(API_KEY);
/**
 * Ask Gemini 2.0 Flash to review the last set.
 * Privacy: we send ONLY numeric per-rep metrics — no video, no images, no landmarks.
 */
export async function coachReview(exercise, reps, signal, viewAngle) {
    if (!geminiEnabled) {
        return "Coach review is disabled. Add VITE_GEMINI_API_KEY to .env to enable.";
    }
    if (reps.length === 0)
        return "No reps to review yet — do a set first.";
    // Build trend summary so Gemini can spot fatigue / improvement without seeing raw JSON
    const scores = reps.map((r) => r.metrics.score ?? 0);
    const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    const firstHalf = scores.slice(0, Math.ceil(scores.length / 2));
    const secondHalf = scores.slice(Math.ceil(scores.length / 2));
    const firstAvg = Math.round(firstHalf.reduce((a, b) => a + b, 0) / (firstHalf.length || 1));
    const secondAvg = Math.round(secondHalf.reduce((a, b) => a + b, 0) / (secondHalf.length || 1));
    const trend = secondAvg > firstAvg + 3 ? "improving" : secondAvg < firstAvg - 3 ? "fatiguing" : "consistent";
    const worstRep = reps.reduce((w, r) => (r.metrics.score ?? 0) < (w.metrics.score ?? 0) ? r : w);
    const bestRep = reps.reduce((b, r) => (r.metrics.score ?? 0) >= (b.metrics.score ?? 0) ? r : b);
    const prompt = `You are an expert strength and conditioning coach reviewing a just-completed set of ${reps.length} ${exercise} reps.${viewAngle ? ` Camera view: ${viewAngle}.` : ""}

SET SUMMARY:
- Average score: ${avgScore}/100 | Trend: ${trend} (first half avg ${firstAvg}, second half avg ${secondAvg})
- Best rep: #${bestRep.repIndex} (score ${bestRep.metrics.score ?? "n/a"})
- Worst rep: #${worstRep.repIndex} (score ${worstRep.metrics.score ?? "n/a"})

PER-REP METRICS (angles in degrees, drift in normalised units, tempo in seconds):
${JSON.stringify(reps, null, 2)}

Instructions:
1. In 1 sentence, name the single most important form issue and which rep it peaked on — cite the specific metric value.
2. In 1 sentence, acknowledge something the athlete did well (with a metric to back it up).
3. In 1 sentence, give ONE concrete drill or cue to fix the main issue before their next set.
4. If the trend is "fatiguing", add a brief note about managing fatigue.
Keep it direct, coach-like, and motivating. No preamble or labels.`;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;
    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.55, maxOutputTokens: 280 },
        }),
        signal,
    });
    if (!res.ok) {
        const label = res.status === 429 ? "rate limited" : `HTTP ${res.status}`;
        throw new Error(`gemini:${label}`);
    }
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ??
        "No coach feedback returned.";
    return text;
}
