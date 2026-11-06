// Cache-bust: force full reload after dep optimization
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import { initNativeBackup } from "./services/nativeBackup";
import "./index.css";

// Register offline support only in production. A service worker must never cache
// Vite's development modules because dependency re-optimization changes their
// hashes and can otherwise mix two React module generations in one page.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    if (import.meta.env.PROD) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Service worker registration failed - app still works without it
      });
      return;
    }

    void navigator.serviceWorker.getRegistrations().then((registrations) =>
      Promise.all(registrations.map((registration) => registration.unregister()))
    );

    if ('caches' in window) {
      void caches.keys().then((cacheNames) =>
        Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)))
      );
    }
  });
}

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

