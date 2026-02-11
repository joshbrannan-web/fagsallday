import * as React from "react";
import * as ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Register service worker for offline support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Service worker registration failed - app still works without it
    });
  });
}

const root = ReactDOM.createRoot(document.getElementById("root")!);
root.render(React.createElement(React.StrictMode, null, React.createElement(App)));

