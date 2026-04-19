import { X } from "lucide-react";

interface SquatTutorialModalProps {
  videoSrc: string;
  onSkip: () => void;
  onClose: () => void;
  onEnded: () => void;
}

export function SquatTutorialModal({ videoSrc, onSkip, onClose, onEnded }: SquatTutorialModalProps) {
  return (
    <div
      role="dialog"
      aria-label="Squat tutorial"
      className="fixed inset-0 z-[70] flex items-end justify-center p-3 sm:items-center sm:p-4"
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-md rounded-2xl glass-card border-brand-accent/30 p-4 shadow-glow-accent animate-scale-in">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-white">Squat Demo</h2>
            <p className="text-sm text-slate-300">Watch first, then tap Start again when you are ready.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-300 transition-smooth hover:bg-white/10 hover:text-white"
            aria-label="Close tutorial"
          >
            <X size={16} />
          </button>
        </div>

        <div className="overflow-hidden rounded-xl border border-white/10 bg-black/40">
          <video
            className="h-full w-full"
            src={videoSrc}
            controls
            autoPlay
            muted
            playsInline
            preload="metadata"
            onEnded={onEnded}
          >
            Your browser does not support embedded videos.
          </video>
        </div>

        <div className="mt-4 flex items-center justify-end">
          <button
            type="button"
            onClick={onSkip}
            className="rounded-full px-4 py-2 text-sm font-semibold text-white/85 ring-1 ring-white/20 transition-smooth hover:bg-white/10 hover:text-white"
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}
