// Cache-bust: force full reload after dep optimization
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import { initNativeBackup } from "./services/nativeBackup";
import "./index.css";
import { applyNativeViewport, isNativeApp, removeWebAppManifest } from "./lib/native";
import { setupServiceWorker } from "./lib/serviceWorker";

// Inside the iOS app, make room for the status bar, Dynamic Island and home indicator.
// Runs before anything is drawn (the app only renders further down), so there is no jump.
applyNativeViewport();
// The "Add to Home Screen" manifest is for the website only.
removeWebAppManifest();

// The website's offline cache: registered on the website's production build only. In
// development and inside the iOS app, any existing service worker and cache are removed.
window.addEventListener('load', () => {
  setupServiceWorker({ isNative: isNativeApp(), isProd: import.meta.env.PROD });
});

function renderApp() {
  const root = ReactDOM.createRoot(document.getElementById("root")!);
  root.render(
    <React.StrictMode>
      <AppErrorBoundary>
        <App />
      </AppErrorBoundary>
    </React.StrictMode>
  );
}

// Inside the iOS app, make sure saved scores and rounds are in place before the app reads
// them (restoring them if iOS cleared the web view's storage). On the website, and on a
// normal iOS launch, this finishes immediately. The app always starts, even if it fails.
initNativeBackup()
  .catch(error => console.error("Native backup startup check failed", error))
  .finally(renderApp);

