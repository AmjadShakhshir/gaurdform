import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import basicSsl from "@vitejs/plugin-basic-ssl";
import { VitePWA } from "vite-plugin-pwa";

// When CAPACITOR=true (used by cap:build script), skip PWA / service worker —
// Capacitor manages asset serving and offline behaviour via its own native layer.
const isCapacitor = process.env.CAPACITOR === "true";

export default defineConfig({
  plugins: [
    react(),
    // basicSsl is only needed for web dev (camera requires HTTPS).
    // Capacitor provides its own secure context via the native WebView.
    ...(!isCapacitor ? [basicSsl()] : []),
    ...(!isCapacitor ? [VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "FormGuard — AI Personal Trainer",
        short_name: "FormGuard",
        description: "Real-time exercise form feedback. Runs in your browser.",
        theme_color: "#0f172a",
        background_color: "#0f172a",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        scope: "/",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
        ]
      },
      workbox: {
        // MediaPipe WASM + model is ~7MB; cache aggressively.
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webmanifest}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/npm\/@mediapipe\/.*/,
            handler: "CacheFirst",
            options: { cacheName: "mediapipe-wasm", expiration: { maxAgeSeconds: 60 * 60 * 24 * 30 } }
          },
          {
            urlPattern: /^https:\/\/storage\.googleapis\.com\/mediapipe-models\/.*/,
            handler: "CacheFirst",
            options: { cacheName: "mediapipe-models", expiration: { maxAgeSeconds: 60 * 60 * 24 * 30 } }
          }
        ]
      }
    })] : [
      // Stub out the PWA virtual module so main.tsx compiles without the PWA plugin.
      {
        name: "capacitor-pwa-stub",
        resolveId(id: string) { if (id === "virtual:pwa-register") return id; },
        load(id: string) { if (id === "virtual:pwa-register") return "export function registerSW() {}"; },
      }
    ]),
  ],
  server: { host: true }
});
