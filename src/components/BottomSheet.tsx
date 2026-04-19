import { useState, useRef, useEffect, type ReactNode } from "react";
import { Brain, TrendingUp, Clock, ChevronUp, Dumbbell, type LucideIcon } from "lucide-react";

type TabId = "workout" | "coach" | "progress" | "history";

interface Props {
  workoutContent: ReactNode;
  coachContent: ReactNode;
  progressContent: ReactNode;
  historyContent: ReactNode;
  /** Increment this value to programmatically close the sheet (e.g. after starting an exercise). */
  closeSignal?: number;
}

const TABS: { id: TabId; label: string; Icon: LucideIcon }[] = [
  { id: "workout",  label: "Workout",  Icon: Dumbbell },
  { id: "coach",    label: "Coach",    Icon: Brain },
  { id: "progress", label: "Progress", Icon: TrendingUp },
  { id: "history",  label: "History",  Icon: Clock },
];

import React from "react";

/** Minimum drag distance (px) to trigger open/close. */
const SWIPE_THRESHOLD = 40;

export function BottomSheet({ workoutContent, coachContent, progressContent, historyContent, closeSignal }: Props) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("workout");

  // Close the sheet when closeSignal changes (e.g. user starts an exercise)
  useEffect(() => {
    if (closeSignal) setOpen(false);
  }, [closeSignal]);

  // Swipe gesture state
  const touchStartY = useRef<number | null>(null);
  const touchCurrentY = useRef<number | null>(null);

  function handleTouchStart(e: React.TouchEvent) {
    touchStartY.current = e.touches[0].clientY;
    touchCurrentY.current = e.touches[0].clientY;
  }

  function handleTouchMove(e: React.TouchEvent) {
    touchCurrentY.current = e.touches[0].clientY;
  }

  function handleTouchEnd() {
    if (touchStartY.current === null || touchCurrentY.current === null) return;
    const delta = touchStartY.current - touchCurrentY.current; // positive = swipe up
    if (delta > SWIPE_THRESHOLD) setOpen(true);
    else if (delta < -SWIPE_THRESHOLD) setOpen(false);
    touchStartY.current = null;
    touchCurrentY.current = null;
  }

  const activeLabel = TABS.find((t) => t.id === activeTab)!.label;

  return (
    <div
      className={`absolute left-0 right-0 z-20 transition-transform duration-300 ease-in-out ${
        open ? "translate-y-0" : "translate-y-[calc(100%-3rem)]"
      }`}
      style={{ bottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      {/* Handle / toggle bar — also handles swipe gestures */}
      <button
        onClick={() => setOpen((v) => !v)}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="w-full h-12 flex items-center justify-between px-5 glass-dark rounded-t-2xl ring-1 ring-white/10"
        aria-label={open ? "Collapse panel" : `Expand ${activeLabel}`}
      >
        {/* Drag handle pill */}
        <div className="absolute left-1/2 -translate-x-1/2 top-2 w-10 h-1 rounded-full bg-white/20" />
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-brand-accent animate-pulse-glow" />
          <span className="text-sm font-semibold text-slate-200">{activeLabel}</span>
        </div>
        <ChevronUp
          size={18}
          className={`text-slate-400 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* Content */}
      <div
        className="glass-dark max-h-[60vh] flex flex-col"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Tab bar */}
        <div className="flex border-b border-white/5 shrink-0">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex-1 py-2.5 text-xs font-medium flex items-center justify-center gap-1.5 transition-smooth ${
                activeTab === tab.id
                  ? "text-brand-accent"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <tab.Icon size={13} />
              {tab.label}
              {activeTab === tab.id && (
                <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-brand-accent tab-underline" />
              )}
            </button>
          ))}
        </div>

        {/* Panel */}
        <div className="overflow-y-auto p-4 space-y-4">
          {activeTab === "workout"  && workoutContent}
          {activeTab === "coach"    && coachContent}
          {activeTab === "progress" && progressContent}
          {activeTab === "history"  && historyContent}
        </div>
      </div>
    </div>
  );
}

