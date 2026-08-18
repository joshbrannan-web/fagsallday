import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Explicitly load .env files so variables are available
  const env = loadEnv(mode, process.cwd(), '');

  return {
    server: {
      host: "::",
      port: 8080,
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      // Package-root deduplication is sufficient and keeps React, ReactDOM, and
      // their subpath exports on one canonical Vite module identity. Absolute
      // subpath aliases can produce mixed optimized chunks after HMR.
      dedupe: ["react", "react-dom", "@tanstack/react-query", "react-router-dom"],
    },
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL || 'https://wvmpxjcghlgtitdhozlj.supabase.co'),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(env.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind2bXB4amNnaGxndGl0ZGhvemxqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYyNDQ1NDMsImV4cCI6MjA4MTgyMDU0M30.W8-qRvLBU2ZykRczLyX6uXd3ThcA0N7Ygn7JpvgEA4A'),
      'import.meta.env.VITE_SUPABASE_PROJECT_ID': JSON.stringify(env.VITE_SUPABASE_PROJECT_ID || 'wvmpxjcghlgtitdhozlj'),
      'import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID': JSON.stringify(env.VITE_GOOGLE_OAUTH_CLIENT_ID || '817303990601-8bkkrj4fuff7ljofnbjl2t23san3d794.apps.googleusercontent.com'),
      // Dev-server restarts are not app releases and must not invalidate the
      // user's local session or offline round cache.
      '__APP_BUILD_HASH__': JSON.stringify(mode === "development" ? "development" : Date.now().toString()),
    },
    optimizeDeps: {
      // Pre-bundle every React entry used by the app as one optimizer batch so
      // the renderer and hooks cannot be served from different generations.
      include: [
        "react",
        "react-dom",
        "react-dom/client",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@radix-ui/react-tooltip",
        "@tanstack/react-query",
      ],
    },
  };
});
