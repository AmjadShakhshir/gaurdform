# FormGuard — Your AI Personal Trainer in the Browser

Real-time exercise form feedback as a PWA. Runs entirely on-device via MediaPipe Pose Landmarker; optional Gemini 2.0 Flash "coach review" for per-set commentary. Zero video ever leaves the browser.

## Stack

- **Vite + React 18 + TypeScript** — fast dev loop, small bundle.
- **MediaPipe Tasks Vision** (`@mediapipe/tasks-vision`) — 33-landmark pose detection at 30+ FPS, WebGL-accelerated, on-device.
- **Tailwind CSS** — styling.
- **vite-plugin-pwa** — installable PWA, offline-first.
- **Supabase** (optional) — magic-link auth + 1 table for session history.
- **Google Gemini 2.0 Flash** (optional) — coach review on demand.

Everything marked "optional" degrades gracefully. The core form-check loop works 100% offline with zero accounts.

## Setup

```bash
pnpm install   # or npm install
cp .env.example .env   # fill in Supabase + Gemini keys (both optional for core demo)
pnpm dev
```

Open `https://localhost:5173` — **HTTPS is required for the camera API**. Vite's dev server does this automatically via the `basicSsl` plugin.

## Architecture

```
src/
├── lib/
│   ├── pose.ts          # MediaPipe wrapper — createLandmarker() + detect loop
│   ├── geometry.ts      # angleDeg(), smoothing (rolling median)
│   ├── feedback.ts      # speak() + vibrate() with throttling
│   ├── gemini.ts        # Coach review call (tiny JSON, not video)
│   └── supabase.ts      # Auth + sessions table client
├── exercises/
│   ├── types.ts         # Exercise, Feedback, Phase, EvalResult
│   ├── squat.ts         # Rule engine + state machine
│   └── bicepCurl.ts     # Rule engine + state machine
├── components/
│   ├── CameraView.tsx   # Video element + skeleton canvas overlay
│   ├── FeedbackChips.tsx
│   ├── RepCounter.tsx
│   ├── ExerciseSelector.tsx
│   └── HistoryPanel.tsx
├── hooks/
│   └── useExerciseSession.ts  # Ties pose loop → exercise evaluator → feedback
└── App.tsx
```

## Why this wins

1. **Realtime.** 30+ FPS feedback. Judges will notice.
2. **Privacy-by-design.** MediaPipe runs in browser WASM. Your video never touches a server. Say this on stage.
3. **Hybrid intelligence.** Rule engine for instant feedback + Gemini for set-level commentary. Best of both.
4. **Offline-first PWA.** Install on phone, use at the gym. Wifi optional.
5. **Helsinki-ready.** GDPR story is the differentiator vs. cloud-fitness incumbents.

## 90-second demo script

1. (10s) **Hook:** "Most form apps send your video to the cloud. FormGuard runs entirely in your browser."
2. (20s) Stand in front of camera. Do 3 squats. Intentionally do a shallow one — the app says "Go deeper" live.
3. (20s) Tap **Bicep curl**. Do 3 reps. Let one elbow drift — "Keep elbow tucked" appears.
4. (15s) Tap **Coach review**. Gemini response appears: "Strong depth on reps 2 and 3. Watch your left elbow on curls — it drifted forward 8%."
5. (15s) Tap **History** — show session log from Supabase.
6. (10s) **Close:** "Works offline. Installs as a PWA. Your data never leaves your device."

Practice 10 times. Time it. The timing is the win.

## What I'd add post-hackathon

- Personalized thresholds (mobility varies — learn the user's baseline after 3 sessions).
- Side-view camera mode for back-squat check (currently front-only).
- Lift-specific exercises (RDL, overhead press, push-up).
- Native mobile wrapper (Capacitor — the PWA code runs unchanged).

## Privacy statement (the hackathon slide)

> Pose estimation runs in your browser via MediaPipe WebAssembly. No video frames, no images, and no landmark coordinates are transmitted to any server. If you opt into Coach Review, only numeric per-rep summaries (joint angles, tempo) are sent to Google Gemini. You can use FormGuard fully offline.
# gaurdform
