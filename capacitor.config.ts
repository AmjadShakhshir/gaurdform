import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.formguard.app',
  appName: 'FormGuard',
  webDir: 'dist',
  server: {
    // Required for getUserMedia (camera) to work on Android WebView
    androidScheme: 'https',
    // Allow MediaPipe CDN assets to load inside the native WebView
    allowNavigation: [
      'cdn.jsdelivr.net',
      'storage.googleapis.com',
    ],
  },
  ios: {
    // Disable iOS rubber-band scrolling — the app uses fixed full-height layout
    scrollEnabled: false,
    allowsLinkPreview: false,
    contentInset: 'always',
  },
  android: {
    // Allow mixed content (http/https) — needed for dev live reload
    allowMixedContent: true,
    // Capture input from WebView (required for fullscreen camera)
    captureInput: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#0f172a',
      showSpinner: false,
      androidSpinnerStyle: 'small',
      iosSpinnerStyle: 'small',
      spinnerColor: '#10b981',
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#0f172a',
    },
  },
};

export default config;
