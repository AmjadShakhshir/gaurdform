import { jsx as _jsx } from "react/jsx-runtime";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { registerSW } from "virtual:pwa-register";
import { SplashScreen } from "@capacitor/splash-screen";
import { StatusBar, Style } from "@capacitor/status-bar";
registerSW({ immediate: true });
ReactDOM.createRoot(document.getElementById("root")).render(_jsx(React.StrictMode, { children: _jsx(App, {}) }));
// Hide splash screen and configure status bar once the app has rendered.
// These are no-ops in the browser (Capacitor gracefully ignores them).
SplashScreen.hide().catch(() => { });
StatusBar.setStyle({ style: Style.Dark }).catch(() => { });
StatusBar.setBackgroundColor({ color: "#0f172a" }).catch(() => { });
