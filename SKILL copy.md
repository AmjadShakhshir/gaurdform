---
name: pose-form-analysis
description: Use when building real-time exercise form feedback in the browser with MediaPipe Pose Landmarker. Covers the detection loop, joint-angle math, rule-engine patterns for squat and bicep curl, rep counting via state machines, multi-modal feedback (visual + speech + haptic), and an optional Gemini 2.0 Flash "coach review" layer. Triggers: any task involving MediaPipe Tasks Vision, pose landmarks, exercise form checking, rep counting from video, or fitness PWAs.
---

# Pose-based exercise form analysis

This skill encodes the decisions that make a form-feedback app actually work in a live demo. Read it once before editing any `src/exercises/*` file.

## 1. Pose detection stack

Use `@mediapipe/tasks-vision` (>=0.10) with `PoseLandmarker`. Do **not** use the older `@mediapipe/pose` package — it's deprecated and has worse performance.

```ts
import { PoseLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

const vision = await FilesetResolver.forVisionTasks(
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm"
);
const landmarker = await PoseLandmarker.createFromOptions(vision, {
  baseOptions: {
    modelAssetPath:
      "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task",
    delegate: "GPU",
  },
  runningMode: "VIDEO",
  numPoses: 1,
  minPoseDetectionConfidence: 0.6,
  minPosePresenceConfidence: 0.6,
  minTrackingConfidence: 0.6,
});
```

Models, in order of quality vs speed: `pose_landmarker_lite` (fastest, mobile), `pose_landmarker_full` (balanced, **default for this app**), `pose_landmarker_heavy` (best accuracy, demo laptops only).

Call `landmarker.detectForVideo(videoEl, performance.now())` inside a `requestAnimationFrame` loop. It returns 33 landmarks per pose. Landmark index reference (memorize these four):
- 11/12: left/right shoulder
- 13/14: left/right elbow
- 15/16: left/right wrist
- 23/24: left/right hip
- 25/26: left/right knee
- 27/28: left/right ankle

Each landmark has `{x, y, z, visibility}` — `x`/`y` are normalized 0..1 to image. Always check `visibility > 0.5` before using a landmark.

## 2. Joint angle math

The only math you need is the 3-point angle (vertex is the middle point).

```ts
export function angleDeg(a: P, b: P, c: P): number {
  const v1 = { x: a.x - b.x, y: a.y - b.y };
  const v2 = { x: c.x - b.x, y: c.y - b.y };
  const dot = v1.x * v2.x + v1.y * v2.y;
  const m1 = Math.hypot(v1.x, v1.y);
  const m2 = Math.hypot(v2.x, v2.y);
  const cos = Math.max(-1, Math.min(1, dot / (m1 * m2)));
  return (Math.acos(cos) * 180) / Math.PI;
}
```

Squat: knee angle = hip–knee–ankle. Bicep curl: elbow angle = shoulder–elbow–wrist.

**Smooth before you judge.** Raw landmarks jitter. Use a 5-frame rolling median on each angle before feeding the rule engine. This alone removes 80% of false "bad form" warnings.

## 3. Rule engine pattern

Each exercise exports a pure function `evaluate(landmarks, state) -> { state, feedback[], repCompleted }`.

**State machine for rep counting** (applies to both squat and curl):

```
READY → DESCENDING → BOTTOM → ASCENDING → READY (rep++)
```

Transition thresholds per exercise (see `src/exercises/squat.ts` for squat numbers). Never count a rep unless the user passed through BOTTOM — prevents half-reps inflating the count.

**Feedback is derived, not stored.** On each frame, run every rule; emit `{ id, severity, message }` chips. The UI dedupes by `id` and fades old ones after 2s. Don't try to "remember" a bad rep — if the person fixes it, the chip disappears.

## 4. Squat rules (in order of severity)

1. **Depth** — at BOTTOM phase, knee angle should reach ≤100°. If min knee angle during descent is >110°, say "Go deeper" at top of next rep.
2. **Knee cave** — distance between knees should be ≥ distance between ankles * 0.7. If knees collapse inward, flag "Push knees out" live.
3. **Back angle** — shoulder-hip-vertical angle should stay <45° forward lean. If >55°, flag "Chest up".
4. **Symmetry** — |left knee angle − right knee angle| should be <15° at BOTTOM. If >20°, flag "Balance your weight".

## 5. Bicep curl rules

1. **Elbow drift** — elbow x-coord should stay within 10% of starting x. If elbow travels forward, flag "Keep elbow tucked".
2. **Range of motion** — elbow angle should go from ≥160° (extended) to ≤60° (contracted). Anything less is a half-rep, don't count.
3. **Shoulder hike** — shoulder y should not rise >5% from resting. If it does, flag "Relax shoulders".
4. **Tempo** — if a rep takes <1.2s, flag "Slow down — control the weight".

## 6. Multi-modal feedback

- **Visual**: render chips over the skeleton overlay. Red for severity=error, yellow=warn, green=good-rep confirmation.
- **Speech**: `speechSynthesis.speak(new SpeechSynthesisUtterance(msg))`. Throttle — max one utterance every 3s, and never interrupt an in-flight one. Use `voice = en-US` with `rate: 1.1` for coach energy.
- **Haptic**: `navigator.vibrate(120)` on rep complete, `navigator.vibrate([60, 40, 60])` on error. No-op on desktop; only meaningful on phone PWA.

## 7. Optional: Gemini 2.0 Flash coach review

**Never send video or raw landmarks to the cloud.** Send only a compact JSON of per-rep summary stats:

```json
{
  "exercise": "squat",
  "reps": 5,
  "perRep": [
    {"minKneeAngle": 98, "maxBackLean": 42, "tempoSec": 2.1, "symmetryDelta": 8}
  ]
}
```

Prompt Gemini with: *"You are a strength coach. Given these metrics from 5 squat reps, give 2 specific, encouraging sentences of feedback."* This keeps tokens tiny, latency <1s, and preserves the privacy story.

## 8. Camera setup rules for the user

- Full body in frame (hips to ankles must be visible for squat).
- Front-facing, distance ~2 meters.
- Plain background helps — reduce false detections.
- Good lighting from the front, not behind (backlit = silhouette = pose fails).

Show these as a setup checklist before the first rep, not buried in settings.

## 9. Common failure modes

| Symptom | Cause | Fix |
|---|---|---|
| Skeleton jitters wildly | Low light or distance | Lower `minPoseDetectionConfidence` to 0.5, or tell user to step closer |
| Rep count jumps by 2 | Noisy angle crossing threshold | Add hysteresis — use different thresholds for DESCENDING→BOTTOM vs BOTTOM→ASCENDING |
| Speech stutters | Overlapping utterances | Check `speechSynthesis.speaking` before enqueueing |
| FPS tanks on Safari | `delegate: "GPU"` not supported | Fall back to `"CPU"` and use `pose_landmarker_lite` |
| Black video on iOS PWA | `playsInline` attribute missing | `<video playsInline muted autoplay>` — all three required |

## 10. Demo script guardrails

The hackathon demo is 90 seconds. Script it:

1. (10s) Hook: "Most form-check apps send your video to the cloud. FormGuard runs entirely in your browser."
2. (20s) Do 3 squats on camera. Intentionally do one shallow — let the app catch it live.
3. (20s) Switch to bicep curl. Do 3 reps, one with elbow drift.
4. (15s) Tap "Coach review" — Gemini response appears.
5. (15s) Open Supabase history panel — show session log.
6. (10s) Close: privacy + offline + installable PWA.

Practice this 10 times. Muscle memory beats improv under judge lights.
