import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

const CACHE_CLEANUP_KEY = "formguard:cache-cleanup:v2";

async function cleanupLegacyPwaCache() {
  try {
    const alreadyCleaned = window.localStorage.getItem(CACHE_CLEANUP_KEY) === "1";
    if (alreadyCleaned) return;

    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }

    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }

    window.localStorage.setItem(CACHE_CLEANUP_KEY, "1");
  } catch {
    // Ignore cleanup failures; app should continue booting.
  }
}

void cleanupLegacyPwaCache();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
