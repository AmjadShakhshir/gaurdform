type Severity = "good" | "warn" | "error" | "critical";

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
export function speak(msg: string): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const now = performance.now();
  if (now - lastSpeakAt < SPEECH_COOLDOWN_MS) return;
  if (msg === lastMessage && now - lastMessageAt < SAME_MSG_COOLDOWN_MS) return;
  if (window.speechSynthesis.speaking) return;

  const u = new SpeechSynthesisUtterance(msg);
  u.rate = 1.1;
  u.pitch = 1.0;
  u.volume = 1.0;
  window.speechSynthesis.speak(u);
  lastSpeakAt = now;
  lastMessage = msg;
  lastMessageAt = now;
}

/** Haptic feedback, scaled by severity, using the web Vibration API when available. */
export function haptic(severity: Severity): void {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
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
}

/** Cancel any queued/active speech. Call on exercise switch or unmount. */
export function cancelSpeech(): void {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
  lastSpeakAt = 0;
  lastMessage = "";
}
