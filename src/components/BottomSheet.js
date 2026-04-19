import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useRef } from "react";
import { Brain, TrendingUp, Clock, ChevronUp } from "lucide-react";
const TABS = [
    { id: "coach", label: "Coach", Icon: Brain },
    { id: "progress", label: "Progress", Icon: TrendingUp },
    { id: "history", label: "History", Icon: Clock },
];
/** Minimum drag distance (px) to trigger open/close. */
const SWIPE_THRESHOLD = 40;
export function BottomSheet({ coachContent, progressContent, historyContent }) {
    const [open, setOpen] = useState(false);
    const [activeTab, setActiveTab] = useState("coach");
    // Swipe gesture state
    const touchStartY = useRef(null);
    const touchCurrentY = useRef(null);
    function handleTouchStart(e) {
        touchStartY.current = e.touches[0].clientY;
        touchCurrentY.current = e.touches[0].clientY;
    }
    function handleTouchMove(e) {
        touchCurrentY.current = e.touches[0].clientY;
    }
    function handleTouchEnd() {
        if (touchStartY.current === null || touchCurrentY.current === null)
            return;
        const delta = touchStartY.current - touchCurrentY.current; // positive = swipe up
        if (delta > SWIPE_THRESHOLD)
            setOpen(true);
        else if (delta < -SWIPE_THRESHOLD)
            setOpen(false);
        touchStartY.current = null;
        touchCurrentY.current = null;
    }
    const activeLabel = TABS.find((t) => t.id === activeTab).label;
    return (_jsxs("div", { className: `absolute left-0 right-0 z-20 transition-transform duration-300 ease-in-out ${open ? "translate-y-0" : "translate-y-[calc(100%-3rem)]"}`, style: { bottom: "env(safe-area-inset-bottom, 0px)" }, children: [_jsxs("button", { onClick: () => setOpen((v) => !v), onTouchStart: handleTouchStart, onTouchMove: handleTouchMove, onTouchEnd: handleTouchEnd, className: "w-full h-12 flex items-center justify-between px-5 glass-dark rounded-t-2xl ring-1 ring-white/10", "aria-label": open ? "Collapse panel" : `Expand ${activeLabel}`, children: [_jsx("div", { className: "absolute left-1/2 -translate-x-1/2 top-2 w-10 h-1 rounded-full bg-white/20" }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "w-2 h-2 rounded-full bg-brand-accent animate-pulse-glow" }), _jsx("span", { className: "text-sm font-semibold text-slate-200", children: activeLabel })] }), _jsx(ChevronUp, { size: 18, className: `text-slate-400 transition-transform duration-300 ${open ? "rotate-180" : ""}` })] }), _jsxs("div", { className: "glass-dark max-h-[60vh] flex flex-col", onTouchStart: handleTouchStart, onTouchMove: handleTouchMove, onTouchEnd: handleTouchEnd, children: [_jsx("div", { className: "flex border-b border-white/5 shrink-0", children: TABS.map((tab) => (_jsxs("button", { type: "button", onClick: () => setActiveTab(tab.id), className: `relative flex-1 py-2.5 text-xs font-medium flex items-center justify-center gap-1.5 transition-smooth ${activeTab === tab.id
                                ? "text-brand-accent"
                                : "text-slate-400 hover:text-white"}`, children: [_jsx(tab.Icon, { size: 13 }), tab.label, activeTab === tab.id && (_jsx("span", { className: "absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-brand-accent tab-underline" }))] }, tab.id))) }), _jsxs("div", { className: "overflow-y-auto p-4 space-y-4", children: [activeTab === "coach" && coachContent, activeTab === "progress" && progressContent, activeTab === "history" && historyContent] })] })] }));
}
