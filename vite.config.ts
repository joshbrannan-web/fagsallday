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
        "react": path.resolve(__dirname, "./node_modules/react"),
        "react-dom": path.resolve(__dirname, "./node_modules/react-dom"),
        "react/jsx-runtime": path.resolve(__dirname, "./node_modules/react/jsx-runtime"),
        "react/jsx-dev-runtime": path.resolve(__dirname, "./node_modules/react/jsx-dev-runtime"),
        "react-dom/client": path.resolve(__dirname, "./node_modules/react-dom/client"),
        "@tanstack/react-query": path.resolve(__dirname, "./node_modules/@tanstack/react-query"),
      },
      dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "react-dom/client", "@tanstack/react-query", "react-router-dom"],
    },
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL || 'https://wvmpxjcghlgtitdhozlj.supabase.co'),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(env.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind2bXB4amNnaGxndGl0ZGhvemxqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYyNDQ1NDMsImV4cCI6MjA4MTgyMDU0M30.W8-qRvLBU2ZykRczLyX6uXd3ThcA0N7Ygn7JpvgEA4A'),
      'import.meta.env.VITE_SUPABASE_PROJECT_ID': JSON.stringify(env.VITE_SUPABASE_PROJECT_ID || 'wvmpxjcghlgtitdhozlj'),
      'import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID': JSON.stringify(env.VITE_GOOGLE_OAUTH_CLIENT_ID || '817303990601-8bkkrj4fuff7ljofnbjl2t23san3d794.apps.googleusercontent.com'),
      '__APP_BUILD_HASH__': JSON.stringify(Date.now().toString()),
    },
    optimizeDeps: {
      include: ["react", "react-dom", "@radix-ui/react-tooltip", "@tanstack/react-query"],
      force: true,
    },
  };
});
