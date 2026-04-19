import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";
import { EXERCISE_CATEGORIES } from "../exercises/index";
export function ExerciseSelector({ selected, onSelect, disabled, compact }) {
    const [open, setOpen] = useState(false);
    const containerRef = useRef(null);
    // Close on outside tap/click
    useEffect(() => {
        if (!open)
            return;
        function handleOutside(e) {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
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
    function handleSelect(ex) {
        navigator.vibrate?.(30);
        onSelect(ex);
        setOpen(false);
    }
    /* ── Full layout (desktop) ── */
    if (!compact) {
        return (_jsx("div", { className: "flex flex-col gap-2", children: Object.entries(EXERCISE_CATEGORIES).map(([category, exs]) => (_jsxs("div", { children: [_jsx("p", { className: "text-xs text-slate-500 uppercase tracking-wide mb-1", children: category }), _jsx("div", { className: "flex flex-wrap gap-1", children: exs.map((ex) => {
                            const active = ex.id === selected.id;
                            return (_jsxs("button", { onClick: () => { navigator.vibrate?.(30); onSelect(ex); }, disabled: disabled, className: `px-4 py-1.5 rounded-xl font-semibold text-sm transition-smooth hover:scale-105 active:scale-95 ${active
                                    ? "bg-gradient-accent text-white shadow-glow-accent-sm"
                                    : "glass-surface text-slate-300 hover:text-white hover:border-white/10"} disabled:opacity-50`, children: [ex.icon && _jsx("span", { className: "mr-1.5", children: ex.icon }), ex.label] }, ex.id));
                        }) })] }, category))) }));
    }
    /* ── Compact layout (mobile) — pill + popover ── */
    return (_jsxs("div", { ref: containerRef, className: "relative", children: [_jsxs("button", { onClick: () => !disabled && setOpen((v) => !v), disabled: disabled, className: `flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-semibold transition-smooth
          glass-dark text-white active:scale-95 disabled:opacity-50
          ${open ? "ring-1 ring-brand-accent/60 shadow-glow-accent-sm" : "ring-1 ring-white/10"}`, "aria-haspopup": "listbox", "aria-expanded": open, children: [selected.icon && _jsx("span", { children: selected.icon }), _jsx("span", { className: "max-w-[120px] truncate", children: selected.label }), _jsx(ChevronDown, { size: 14, className: `text-slate-400 transition-transform duration-200 ${open ? "rotate-180 text-brand-accent" : ""}` })] }), open && (_jsxs("div", { className: "absolute right-0 top-full mt-2 w-64 rounded-2xl glass-dark\n            ring-1 ring-brand-accent/20 shadow-glow-accent z-30 overflow-hidden dropdown-enter", role: "listbox", "aria-label": "Select exercise", children: [Object.entries(EXERCISE_CATEGORIES).map(([category, exs]) => (_jsxs("div", { children: [_jsx("p", { className: "text-[10px] uppercase tracking-widest text-slate-500 font-semibold px-4 pt-3 pb-1", children: category }), _jsx("div", { className: "px-2 pb-1", children: exs.map((ex) => {
                                    const active = ex.id === selected.id;
                                    return (_jsxs("button", { role: "option", "aria-selected": active, onClick: () => handleSelect(ex), className: `w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-smooth
                        ${active
                                            ? "bg-brand-accent/15 text-brand-accent"
                                            : "text-slate-300 hover:bg-white/5 active:bg-white/10"}`, children: [_jsx("span", { className: "text-base w-6 text-center", children: ex.icon ?? "·" }), _jsx("span", { children: ex.label }), active && _jsx(Check, { size: 14, className: "ml-auto text-brand-accent" })] }, ex.id));
                                }) })] }, category))), _jsx("div", { className: "h-2" })] }))] }));
}
