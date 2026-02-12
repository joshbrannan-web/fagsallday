

## Fix: Restore the .env File

The `.env` file was deleted from the repo, but `src/integrations/supabase/client.ts` reads `import.meta.env.VITE_SUPABASE_URL` and `import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY` at startup. Without these values, the Supabase client throws "supabaseUrl is required" and the app crashes.

### What needs to happen

Recreate the `.env` file at the project root with the three environment variables this project needs:

```
VITE_SUPABASE_PROJECT_ID="wvmpxjcghlgtitdhozlj"
VITE_SUPABASE_URL="https://wvmpxjcghlgtitdhozlj.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind2bXB4amNnaGxndGl0ZGhvemxqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYyNDQ1NDMsImV4cCI6MjA4MTgyMDU0M30.W8-qRvLBU2ZykRczLyX6uXd3ThcA0N7Ygn7JpvgEA4A"
```

These are all public/publishable values -- they are designed to be in client-side code and are not secrets.

### Why this is safe
- The `VITE_SUPABASE_URL` is just the project endpoint (public).
- The `VITE_SUPABASE_PUBLISHABLE_KEY` is the anon key, which is intentionally public. Security is enforced by Row Level Security (RLS) policies on the database, not by hiding this key.
- This file is auto-managed by Lovable Cloud and is expected to exist.

### Technical detail
No other code changes are needed. The Supabase client in `src/integrations/supabase/client.ts` already reads these variables correctly -- it just needs them to be present.
