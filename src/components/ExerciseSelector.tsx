import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";
import type { ExerciseDefinition } from "../exercises/types";
import { EXERCISE_CATEGORIES } from "../exercises/index";

interface Props {
  selected: ExerciseDefinition;
  onSelect: (e: ExerciseDefinition) => void;
  disabled?: boolean;
  /** Compact mode: shows a single pill that opens a popover. Used on mobile. */
  compact?: boolean;
}

export function ExerciseSelector({ selected, onSelect, disabled, compact }: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside tap/click
  useEffect(() => {
    if (!open) return;
    function handleOutside(e: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("touchstart", handleOutside, { passive: true });
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("touchstart", handleOutside);
    };
  }, [open]);

  function handleSelect(ex: ExerciseDefinition) {
    navigator.vibrate?.(30);
    onSelect(ex);
    setOpen(false);
  }

  /* ── Full layout (desktop) ── */
  if (!compact) {
    return (
      <div className="flex flex-col gap-2">
        {Object.entries(EXERCISE_CATEGORIES).map(([category, exs]) => (
          <div key={category}>
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">{category}</p>
            <div className="flex flex-wrap gap-1">
              {exs.map((ex) => {
                const active = ex.id === selected.id;
                return (
                  <button
                    key={ex.id}
                    onClick={() => { navigator.vibrate?.(30); onSelect(ex); }}
                    disabled={disabled}
                    className={`px-4 py-1.5 rounded-xl font-semibold text-sm transition-smooth hover:scale-105 active:scale-95 ${
                      active
                        ? "bg-gradient-accent text-white shadow-glow-accent-sm"
                        : "glass-surface text-slate-300 hover:text-white hover:border-white/10"
                    } disabled:opacity-50`}
                  >
                    {ex.icon && <span className="mr-1.5">{ex.icon}</span>}
                    {ex.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
 }

  /* ── Compact layout (mobile) — pill + popover ── */
  return (
    <div ref={containerRef} className="relative">
      {/* Pill button showing current exercise */}
      <button
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-semibold transition-smooth
          glass-dark text-white active:scale-95 disabled:opacity-50
          ${ open ? "ring-1 ring-brand-accent/60 shadow-glow-accent-sm" : "ring-1 ring-white/10" }`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {selected.icon && <span>{selected.icon}</span>}
        <span className="max-w-[120px] truncate">{selected.label}</span>
        <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 ${open ? "rotate-180 text-brand-accent" : ""}`} />
      </button>

      {/* Popover dropdown */}
      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-64 rounded-2xl glass-dark
            ring-1 ring-brand-accent/20 shadow-glow-accent z-30 overflow-hidden dropdown-enter"
          role="listbox"
          aria-label="Select exercise"
        >
          {Object.entries(EXERCISE_CATEGORIES).map(([category, exs]) => (
            <div key={category}>
              <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold px-4 pt-3 pb-1">
                {category}
              </p>
              <div className="px-2 pb-1">
                {exs.map((ex) => {
                  const active = ex.id === selected.id;
                  return (
                    <button
                      key={ex.id}
                      role="option"
                      aria-selected={active}
                      onClick={() => handleSelect(ex)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-smooth
                        ${active
                          ? "bg-brand-accent/15 text-brand-accent"
                          : "text-slate-300 hover:bg-white/5 active:bg-white/10"
                        }`}
                    >
                      <span className="text-base w-6 text-center">{ex.icon ?? "·"}</span>
                      <span>{ex.label}</span>
                      {active && <Check size={14} className="ml-auto text-brand-accent" />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <div className="h-2" />
        </div>
      )}
    </div>
  );
}

