import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
const SPEECH_COOLDOWN_MS = 3000;
const SAME_MSG_COOLDOWN_MS = 8000;
let lastSpeakAt = 0;
let lastMessage = "";
let lastMessageAt = 0;
/**
 * Speak a short message. Throttles globally (one utterance / 3s) and
 * suppresses the same message within 8s. Safely no-ops if speechSynthesis
 * is unavailable or muted by the user.
 */
export function speak(msg) {
    if (typeof window === "undefined" || !("speechSynthesis" in window))
        return;
    const now = performance.now();
    if (now - lastSpeakAt < SPEECH_COOLDOWN_MS)
        return;
    if (msg === lastMessage && now - lastMessageAt < SAME_MSG_COOLDOWN_MS)
        return;
    if (window.speechSynthesis.speaking)
        return;
    const u = new SpeechSynthesisUtterance(msg);
    u.rate = 1.1;
    u.pitch = 1.0;
    u.volume = 1.0;
    window.speechSynthesis.speak(u);
    lastSpeakAt = now;
    lastMessage = msg;
    lastMessageAt = now;
}
/** Haptic feedback, scaled by severity.
 *  Uses Capacitor Haptics on native (iOS/Android) for reliable patterns,
 *  falls back to the web Vibration API on desktop browsers.
 */
export function haptic(severity) {
    // Try Capacitor native haptics first (works on iOS where navigator.vibrate is absent)
    Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {
        // Not on a native platform — fall back to web Vibration API
        if (typeof navigator === "undefined" || !("vibrate" in navigator))
            return;
        switch (severity) {
            case "good":
                navigator.vibrate(80);
                break;
            case "warn":
                navigator.vibrate([60, 40, 60]);
                break;
            case "error":
                navigator.vibrate([100, 50, 100, 50, 100]);
                break;
            case "critical":
                navigator.vibrate([100, 30, 100, 30, 200]);
                break;
        }
    });
    // Override impact style per severity on native
    if (severity === "good") {
        Haptics.notification({ type: NotificationType.Success }).catch(() => { });
    }
    else if (severity === "critical") {
        Haptics.notification({ type: NotificationType.Error }).catch(() => { });
    }
}
/** Cancel any queued/active speech. Call on exercise switch or unmount. */
export function cancelSpeech() {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
    }
    lastSpeakAt = 0;
    lastMessage = "";
}
