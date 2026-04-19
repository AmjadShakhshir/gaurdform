/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: "#0f172a",
          accent: "#10b981",
          "accent-glow": "#34d399",
          warn: "#f59e0b",
          err: "#ef4444",
          purple: "#a78bfa",
          "purple-glow": "#c4b5fd",
          surface: "#1e293b",
          "surface-light": "#334155",
        }
      },
      fontFamily: { sans: ["Inter", "system-ui", "sans-serif"] },
      boxShadow: {
        "glow-accent": "0 0 20px rgba(16,185,129,0.35), 0 0 60px rgba(16,185,129,0.12)",
        "glow-accent-sm": "0 0 10px rgba(16,185,129,0.4)",
        "glow-purple": "0 0 20px rgba(167,139,250,0.35)",
        "glow-err": "0 0 15px rgba(239,68,68,0.35)",
        "glow-warn": "0 0 15px rgba(245,158,11,0.35)",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-accent": "linear-gradient(135deg, #10b981, #34d399)",
        "gradient-hero": "linear-gradient(180deg, rgba(16,185,129,0.08) 0%, transparent 60%)",
        "gradient-surface": "linear-gradient(135deg, rgba(30,41,59,0.9), rgba(15,23,42,0.95))",
      },
      animation: {
        "pulse-glow": "pulseGlow 2s ease-in-out infinite",
        "slide-up": "slideUp 300ms cubic-bezier(0.4,0,0.2,1) both",
        "fade-in": "fadeIn 220ms ease-out both",
        "scale-in": "scaleIn 250ms cubic-bezier(0.34,1.56,0.64,1) both",
        "confetti-fall": "confettiFall var(--fall-duration, 2.5s) var(--fall-delay, 0s) linear forwards",
        "shimmer": "shimmer 2s linear infinite",
        "spin-slow": "spin 3s linear infinite",
      },
      keyframes: {
        pulseGlow: {
          "0%, 100%": { boxShadow: "0 0 10px rgba(16,185,129,0.3), 0 0 30px rgba(16,185,129,0.1)" },
          "50%": { boxShadow: "0 0 25px rgba(16,185,129,0.6), 0 0 60px rgba(16,185,129,0.25)" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        scaleIn: {
          from: { opacity: "0", transform: "scale(0.85)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        confettiFall: {
          "0%": { transform: "translateY(-20px) rotate(var(--rot-start, 0deg))", opacity: "1" },
          "100%": { transform: "translateY(110vh) rotate(var(--rot-end, 720deg))", opacity: "0.3" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% center" },
          "100%": { backgroundPosition: "200% center" },
        },
      },
    }
  },
  plugins: []
};
