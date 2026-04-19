import { useRef, useState, useEffect } from "react";
import { Shield, Timer, Coffee, Square, Dumbbell, CalendarDays } from "lucide-react";
import { EXERCISES } from "./exercises/index";
import type { ExerciseDefinition, ExerciseId } from "./exercises/types";
import { useExerciseSession } from "./hooks/useExerciseSession";
import { useIsMobile } from "./hooks/useIsMobile";
import { useTraineeData } from "./hooks/useTraineeData";
import { CameraView } from "./components/CameraView";
import { FeedbackChips } from "./components/FeedbackChips";
import { RepCounter } from "./components/RepCounter";
import { ExerciseSelector } from "./components/ExerciseSelector";
import { CoachReview } from "./components/CoachReview";
import { HistoryPanel } from "./components/HistoryPanel";
import { BottomSheet } from "./components/BottomSheet";
import { StreakBadge } from "./components/StreakBadge";
import { PRCelebration } from "./components/PRCelebration";
import { ProgressPanel } from "./components/ProgressPanel";
import { SquatTutorialModal } from "./components/SquatTutorialModal";
import { PlanBuilder } from "./components/PlanBuilder";
import { WorkoutView } from "./components/WorkoutView";
import { useWorkoutSession } from "./hooks/useWorkoutSession";
import { getTraineeProfile, saveTraineeProfile, saveTrainingPlan } from "./lib/localDb";
import type { TraineeProfile, TrainingPlan } from "./lib/trainingPlan";
import type { DetectedPR } from "./lib/personalRecords";

const SQUAT_TUTORIAL_SEEN_KEY = "formguard:squat-tutorial-seen:v1";

export default function App() {
  const exercises: ExerciseDefinition[] = EXERCISES;
  const [selected, setSelected] = useState<ExerciseDefinition>(exercises[0]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const sessionStartRef = useRef<number>(Date.now());
  const { status, statusMsg, state, activeFeedback, landmarks, viewAngle, setComplete, fps, start, stop } =
    useExerciseSession(selected, videoRef);
  const isMobile = useIsMobile();
  const traineeData = useTraineeData();
  const [pendingPRs, setPendingPRs] = useState<DetectedPR[]>([]);
  const [saveError, setSaveError] = useState("");
  const [sessionElapsed, setSessionElapsed] = useState(0);
  const [restSecondsLeft, setRestSecondsLeft] = useState<number | null>(null);
  const [showSquatTutorial, setShowSquatTutorial] = useState(false);
  const [hasSeenSquatTutorialEver, setHasSeenSquatTutorialEver] = useState(false);
  const [showPlanBuilder, setShowPlanBuilder] = useState(false);
  const [sheetCloseSignal, setSheetCloseSignal] = useState(0);
  const workoutSession = useWorkoutSession();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const seen = window.localStorage.getItem(SQUAT_TUTORIAL_SEEN_KEY) === "1";
    if (seen) setHasSeenSquatTutorialEver(true);
  }, []);

  // Check if the trainee has a profile; show plan builder on first launch
  useEffect(() => {
    getTraineeProfile().then((profile) => {
      if (!profile) setShowPlanBuilder(true);
    });
  }, []);

  function formatSec(sec: number) {
    const m = Math.floor(sec / 60).toString().padStart(2, "0");
    const s = (sec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

  // Track session start time
  useEffect(() => {
    if (status === "ready") sessionStartRef.current = Date.now();
  }, [status]);

  // Session elapsed timer — counts up while running
  useEffect(() => {
    if (status !== "ready") { setSessionElapsed(0); return; }
    const id = setInterval(() => setSessionElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [status]);

  // Rest timer — counts down after a set ends
  useEffect(() => {
    if (restSecondsLeft === null) return;
    if (restSecondsLeft <= 0) { setRestSecondsLeft(null); return; }
    const id = setTimeout(() => setRestSecondsLeft((s) => (s ?? 1) - 1), 1000);
    return () => clearTimeout(id);
  }, [restSecondsLeft]);

  // Save session and detect PRs when user stops
  const endSession = async () => {
    if (state.reps > 0) {
      try {
        const durationSec = Math.round((Date.now() - sessionStartRef.current) / 1000);
        const scores = state.repLog.map((r) => r.metrics.score ?? 0).filter((v) => v > 0);
        const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
        const bestScore = scores.length > 0 ? Math.max(...scores) : null;

        const newPRs = await traineeData.saveSession({
          exercise: selected.id,
          reps: state.reps,
          avg_metric: avgScore !== null ? Number(avgScore.toFixed(1)) : null,
          best_score: bestScore !== null ? Number(bestScore.toFixed(1)) : null,
          session_duration_sec: durationSec,
          metrics_json: state.repLog.length > 0 ? state.repLog : null,
        });

        setSaveError("");
        if (newPRs.length > 0) setPendingPRs(newPRs);
        workoutSession.markSetDone(selected.id as ExerciseId);
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : "Could not save this workout yet. Try again.");
        return;
      }
    }
    stop();
    setRestSecondsLeft(60);
  };

  useEffect(() => {
    // Cleanup on exercise change while running
    if (status === "ready") stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  useEffect(() => {
    if (selected.id !== "squat") setShowSquatTutorial(false);
  }, [selected.id]);

  useEffect(() => {
    setSaveError("");
  }, [selected.id]);

  useEffect(() => {
    if (status !== "idle") setShowSquatTutorial(false);
  }, [status]);

  const shouldShowSquatTutorialBeforeStart =
    isMobile &&
    status === "idle" &&
    selected.id === "squat" &&
    !hasSeenSquatTutorialEver;

  const closeSquatTutorial = () => {
    setShowSquatTutorial(false);
  };

  const skipSquatTutorial = () => {
    setHasSeenSquatTutorialEver(true);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SQUAT_TUTORIAL_SEEN_KEY, "1");
    }
    setShowSquatTutorial(false);
  };

  const endSquatTutorial = () => {
    setHasSeenSquatTutorialEver(true);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SQUAT_TUTORIAL_SEEN_KEY, "1");
    }
    setShowSquatTutorial(false);
  };

  const handleStart = () => {
    setSaveError("");
    if (shouldShowSquatTutorialBeforeStart) {
      setShowSquatTutorial(true);
      return;
    }
    start();
  };

  const handlePlanConfirm = async (profile: TraineeProfile, plan: TrainingPlan) => {
    await saveTraineeProfile(profile);
    await saveTrainingPlan(plan);
    setShowPlanBuilder(false);
    await workoutSession.reloadPlan();
  };

  const handleStartFromWorkout = (exerciseId: ExerciseId) => {
    const ex = EXERCISES.find((e) => e.id === exerciseId);
    if (ex) {
      setSelected(ex);
      setSheetCloseSignal((s) => s + 1);
    }
  };

  const ctaLabel =
    status === "idle"
      ? "Start"
      : status === "loading"
        ? statusMsg || "Loading…"
        : status === "ready"
          ? "Stop & save"
          : "Retry";

  const overlayError = saveError || statusMsg;

  const coachPanel = (
    <CoachReview exercise={selected.id} state={state} autoTrigger={setComplete} viewAngle={viewAngle} />
  );
  const progressPanel = (
    <ProgressPanel sessions={traineeData.sessions} prs={traineeData.prs} />
  );
  const historyPanel = (
    <HistoryPanel sessions={traineeData.sessions} prs={traineeData.prs} />
  );

  const workoutPanel =
    workoutSession.plan && workoutSession.todayWorkout ? (
      <WorkoutView
        plan={workoutSession.plan}
        todayWorkout={workoutSession.todayWorkout}
        todayDayIndex={workoutSession.todayDayIndex}
        completedSets={workoutSession.completedSets}
        currentExerciseIdx={workoutSession.currentExerciseIdx}
        isWorkoutComplete={workoutSession.isWorkoutComplete}
        onStartExercise={handleStartFromWorkout}
        onCompleteWorkout={workoutSession.completeWorkout}
      />
    ) : (
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <span className="text-4xl">📋</span>
        <p className="text-sm text-white/60">No training plan yet.</p>
        <button
          onClick={() => setShowPlanBuilder(true)}
          className="px-5 py-2.5 rounded-xl bg-gradient-accent text-brand-bg font-bold text-sm shadow-glow-accent transition-smooth active:scale-95"
        >
          Build my training plan
        </button>
      </div>
    );

  const counterTarget = selected.targetCount ?? 10;
  const counterUnit = selected.counterUnit ?? "reps";
  const counterValue =
    selected.id === "plank"
      ? Math.min(counterTarget, state.phase === "HOLDING" ? state.scratch.holdSec ?? 0 : state.reps)
      : state.reps;

  return (
    /* Mobile: fullscreen fixed viewport. Desktop: normal scrollable page */
    <div className="relative overflow-hidden h-[100dvh] md:h-auto md:overflow-visible md:min-h-screen md:max-w-5xl md:mx-auto md:px-4 md:py-6 md:space-y-6 bg-brand-bg">

      {/* ── Desktop header (hidden on mobile) ── */}
      <header className="hidden md:flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Shield size={28} className="text-brand-accent" />
            <span className="text-gradient-brand">FormGuard</span>
            <span className="text-slate-400 font-normal text-base ml-1">AI trainer in your browser</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Pose runs on-device via MediaPipe. Your video never leaves this page.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowPlanBuilder(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl glass-card text-white/60 hover:text-white text-xs font-medium transition-smooth"
          >
            <CalendarDays size={14} className="text-brand-accent" />
            My Plan
          </button>
          <StreakBadge streakInfo={traineeData.streakInfo} />
          <ExerciseSelector
            selected={selected}
            onSelect={setSelected}
            disabled={status === "loading"}
          />
        </div>
      </header>

      {/* ── Desktop setup tip (hidden on mobile) ── */}
      {status === "idle" && (
        <div className="hidden md:flex items-center gap-3 glass-card rounded-xl p-4 text-sm text-slate-300 animate-slide-up">
          <Dumbbell size={16} className="text-brand-accent shrink-0" />
          <span><span className="font-semibold text-brand-accent">Setup:</span> {selected.setupTip}</span>
        </div>
      )}

      {/* ── Camera container ──
           Mobile: absolute inset-0 (fills entire h-[100dvh] root).
           Desktop: relative in-flow with aspect-video ratio. */}
      <div className="absolute inset-0 md:relative md:inset-auto">
        <CameraView videoRef={videoRef} landmarks={landmarks} mirrored viewAngle={viewAngle} supportedViews={selected.supportedViews} />

        {/* Top gradient overlay — branding fade on mobile */}
        <div className="md:hidden absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-black/50 to-transparent pointer-events-none z-[1]" />

        {/* Start / Loading / Retry overlay */}
        {status !== "ready" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/50 backdrop-blur-[2px] md:rounded-2xl">
            {/* Rest timer — shown on mobile after a set ends */}
            {restSecondsLeft !== null ? (
              <div className="md:hidden flex flex-col items-center gap-4 animate-scale-in">
                <div className="glass-card rounded-2xl px-8 py-6 flex flex-col items-center gap-3">
                  <div className="flex items-center gap-2 text-slate-300">
                    <Coffee size={16} />
                    <span className="text-sm font-semibold uppercase tracking-widest">Rest</span>
                  </div>
                  {/* SVG countdown ring */}
                  <div className="relative w-24 h-24">
                    <svg className="absolute inset-0 -rotate-90" width="96" height="96">
                      <circle cx="48" cy="48" r="40" fill="none" stroke="rgba(30,41,59,0.8)" strokeWidth="6" />
                      <circle
                        cx="48" cy="48" r="40" fill="none"
                        stroke="#a78bfa" strokeWidth="6" strokeLinecap="round"
                        strokeDasharray={`${2 * Math.PI * 40}`}
                        strokeDashoffset={`${2 * Math.PI * 40 * (1 - restSecondsLeft / 60)}`}
                        style={{ transition: "stroke-dashoffset 0.9s linear", filter: "drop-shadow(0 0 8px rgba(167,139,250,0.7))" }}
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-3xl font-bold tabular-nums text-white font-mono">{restSecondsLeft}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setRestSecondsLeft(null)}
                    className="px-5 py-1.5 rounded-full glass-card text-white/70 text-sm hover:text-white transition-smooth"
                  >
                    Skip
                  </button>
                </div>
              </div>
            ) : (
              <>
                <button
                  onClick={handleStart}
                  disabled={status === "loading"}
                  className="px-8 py-4 rounded-2xl bg-gradient-accent text-white font-bold text-lg shadow-glow-accent hover:shadow-glow-accent transition-smooth disabled:opacity-60 animate-scale-in"
                >
                  {ctaLabel}
                </button>
                {/* Setup tip shown inline on mobile when idle */}
                {status === "idle" && (
                  <div className="md:hidden glass-card rounded-xl p-3 text-center text-sm text-slate-300 max-w-xs mx-4 animate-fade-in">
                    <span className="font-semibold text-brand-accent">Setup:</span>{" "}
                    {selected.setupTip}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Feedback chips */}
        {status === "ready" && (
          <div className="absolute top-12 md:top-4 inset-x-0 px-4">
            <FeedbackChips items={activeFeedback} />
          </div>
        )}

        {/* ── Mobile: exercise selector overlay (top) ── */}
        <div className="md:hidden absolute top-0 inset-x-0 flex justify-between items-start pt-safe-top px-4 z-10 pointer-events-none">
          <div className="pointer-events-auto mt-1">
            <StreakBadge streakInfo={traineeData.streakInfo} />
          </div>
          <div className="pointer-events-auto">
            <ExerciseSelector
              selected={selected}
              onSelect={setSelected}
              disabled={status === "loading"}
              compact
            />
          </div>
        </div>

        {/* ── Mobile: rep counter + stop button overlays (bottom) ── */}
        {status === "ready" && (
          <>
            <div className="md:hidden absolute bottom-24 left-4 z-10 flex flex-col gap-2">
              <div className="glass-dark rounded-xl p-2">
                <RepCounter
                  state={state}
                  compact
                  targetCount={counterTarget}
                  valueOverride={counterValue}
                  counterUnit={counterUnit}
                />
              </div>
              {/* Session elapsed timer */}
              <div className="glass-dark rounded-lg px-3 py-1 flex items-center gap-1.5">
                <Timer size={11} className="text-brand-accent" />
                <span className="text-xs text-slate-300 tabular-nums font-mono">{formatSec(sessionElapsed)}</span>
              </div>
            </div>
            <div className="md:hidden absolute bottom-24 right-4 z-10 flex flex-col items-end gap-2">
              {fps > 0 && (
                <span className="text-xs text-white/50 tabular-nums glass-dark px-2 py-0.5 rounded-md">
                  {fps} fps
                </span>
              )}
              <button
                onClick={endSession}
                className="flex items-center gap-2 px-4 py-2 rounded-xl glass-card border-red-500/30 text-red-300 font-semibold text-sm shadow-glow-err hover:text-red-200 transition-smooth"
              >
                <Square size={14} fill="currentColor" />
                Stop
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── Desktop: rep counter + controls row ── */}
      <div className="hidden md:flex items-center justify-between gap-4 flex-wrap glass-card rounded-2xl p-4">
        <RepCounter
          state={state}
          targetCount={counterTarget}
          valueOverride={counterValue}
          counterUnit={counterUnit}
        />
        <div className="flex items-center gap-3">
          {fps > 0 && status === "ready" && (
            <span className="text-xs text-slate-500 tabular-nums">{fps} fps</span>
          )}
          {status === "ready" && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 glass-dark rounded-lg px-3 py-1.5">
                <Timer size={13} className="text-brand-accent" />
                <span className="text-sm tabular-nums font-mono text-slate-300">{formatSec(sessionElapsed)}</span>
              </div>
              <button
                onClick={endSession}
                className="flex items-center gap-2 px-5 py-2 rounded-xl glass-card border-red-500/30 text-red-300 font-semibold shadow-glow-err hover:text-red-200 transition-smooth"
              >
                <Square size={14} fill="currentColor" />
                Stop & save
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Desktop: error banner ── */}
      {overlayError && !isMobile && (
        <div className="hidden md:block rounded-xl bg-brand-err/20 ring-1 ring-brand-err/50 p-4 text-sm">
          <strong>Error:</strong> {overlayError}
        </div>
      )}

      {/* ── Mobile: error toast overlay ── */}
      {overlayError && isMobile && (
        <div className="md:hidden absolute top-16 inset-x-0 px-4 z-10">
          <div className="rounded-xl bg-brand-err/90 backdrop-blur-sm p-3 text-sm text-white">
            <strong>Error:</strong> {overlayError}
          </div>
        </div>
      )}

      {/* ── Desktop: panels grid ── */}
      {!isMobile && (
        <>
          {workoutSession.plan && workoutSession.todayWorkout && (
            <div className="glass-card rounded-2xl p-4 animate-slide-up">
              {workoutPanel}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="glass-card rounded-2xl p-4 animate-slide-up stagger-1">{coachPanel}</div>
            <div className="space-y-4">
              <div className="glass-card rounded-2xl p-4 animate-slide-up stagger-2">{progressPanel}</div>
              <div className="glass-card rounded-2xl p-4 animate-slide-up stagger-3">{historyPanel}</div>
            </div>
          </div>
        </>
      )}

      {/* Mobile bottom sheet */}
      {isMobile && (
        <BottomSheet
          workoutContent={workoutPanel}
          coachContent={coachPanel}
          progressContent={progressPanel}
          historyContent={historyPanel}
          closeSignal={sheetCloseSignal}
        />
      )}

      {/* PR celebration overlay */}
      {pendingPRs.length > 0 && (
        <PRCelebration prs={pendingPRs} onDismiss={() => setPendingPRs([])} />
      )}

      {/* Training plan builder overlay */}
      {showPlanBuilder && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <PlanBuilder onConfirm={handlePlanConfirm} />
        </div>
      )}

      {isMobile && status === "idle" && selected.id === "squat" && showSquatTutorial && (
        <SquatTutorialModal
          videoSrc="/videos/squat-tutorial.mp4"
          onSkip={skipSquatTutorial}
          onClose={closeSquatTutorial}
          onEnded={endSquatTutorial}
        />
      )}

      {/* ── Desktop footer ── */}
      <footer className="hidden md:block pt-6 border-t border-white/5 text-xs text-slate-500 space-y-1">
        <p>
          <strong className="text-slate-300">Privacy:</strong> Pose estimation runs in
          your browser. No frames, images, or landmark coordinates are ever sent to a
          server. Optional coach review sends only numeric per-rep summaries.
        </p>
        <p>
          <strong className="text-slate-300">Install:</strong> Tap the browser menu
          &rarr; "Add to Home Screen" to use FormGuard offline.
        </p>
      </footer>
    </div>
  );
}
