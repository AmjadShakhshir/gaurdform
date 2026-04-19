import { LM } from "./pose";
// Rolling mode-vote buffer — 7 frames smooths out momentary mis-detections.
const VIEW_WINDOW = 7;
const viewBuffer = [];
/** Call on session start or exercise change to flush the buffer. */
export function resetViewAngle() {
    viewBuffer.length = 0;
}
/**
 * Raw per-frame classification based on landmark geometry.
 *
 * Primary signal: shoulder z-delta (MediaPipe normalises z relative to hip
 * midpoint; negative = closer to camera). When the camera is on the left,
 * the left shoulder has a more-negative z than the right → zDelta < 0 → "side-left".
 * When front-on both shoulders sit at similar depth → |zDelta| ≈ 0.
 *
 * Fallback: x-width + visibility if z is unavailable.
 */
function rawDetect(landmarks) {
    if (!landmarks || landmarks.length < 13)
        return "unknown";
    const lSh = landmarks[LM.LEFT_SHOULDER];
    const rSh = landmarks[LM.RIGHT_SHOULDER];
    const nose = landmarks[LM.NOSE];
    const lShVis = lSh.visibility ?? 0;
    const rShVis = rSh.visibility ?? 0;
    const noseVis = nose.visibility ?? 0;
    // Both shoulders completely occluded → give up.
    if (lShVis < 0.20 && rShVis < 0.20)
        return "unknown";
    const shoulderWidth = Math.abs(lSh.x - rSh.x);
    // ── PRIMARY: z-depth delta between shoulders ─────────────────────────────
    // MediaPipe z is available on almost every device with the "full" model.
    if (lSh.z !== undefined && rSh.z !== undefined) {
        const zDelta = lSh.z - rSh.z; // negative → left shoulder closer → side-left
        const zAbs = Math.abs(zDelta);
        if (zAbs > 0.08) {
            // Significant depth offset → side view.
            return zDelta < 0 ? "side-left" : "side-right";
        }
        if (zAbs < 0.04 && shoulderWidth > 0.10 && lShVis > 0.30 && rShVis > 0.30) {
            // Both shoulders at similar depth → front or back.
            return noseVis > 0.35 ? "front" : "back";
        }
        // Ambiguous z — fall through to x-width logic below.
    }
    // ── FALLBACK: projected shoulder span (no z available) ───────────────────
    if (shoulderWidth < 0.10) {
        const visDiff = lShVis - rShVis; // + → left more visible
        if (Math.abs(visDiff) > 0.15) {
            return visDiff > 0 ? "side-left" : "side-right";
        }
        return "unknown";
    }
    if (shoulderWidth > 0.12 && lShVis > 0.35 && rShVis > 0.35) {
        return noseVis > 0.35 ? "front" : "back";
    }
    return "unknown";
}
function modeOf(arr) {
    const counts = new Map();
    for (const v of arr)
        counts.set(v, (counts.get(v) ?? 0) + 1);
    let best = "unknown";
    let bestCount = 0;
    for (const [v, c] of counts) {
        if (c > bestCount) {
            best = v;
            bestCount = c;
        }
    }
    return best;
}
/**
 * Detect camera orientation from pose landmarks.
 * Returns a smoothed classification using a 7-frame mode vote.
 */
export function detectViewAngle(landmarks) {
    const raw = rawDetect(landmarks);
    viewBuffer.push(raw);
    if (viewBuffer.length > VIEW_WINDOW)
        viewBuffer.shift();
    return modeOf(viewBuffer);
}
/** Human-readable label for the view angle badge. */
export function viewAngleLabel(v) {
    switch (v) {
        case "front": return "▲ Front";
        case "back": return "▼ Back";
        case "side-left": return "◀ Side";
        case "side-right": return "▶ Side";
        default: return "? Angle";
    }
}
