

## Fix: Admin Portal Not Loading (CORS Issue)

### Problem
All backend functions have a hardcoded list of allowed origins for security (CORS). The preview environment uses a different URL (`id-preview--...lovable.app`) that isn't in that list, so every request from the preview is blocked -- causing the "Failed to load admin data" error.

### Solution
Update all 6 backend functions to also accept requests from the preview URL. This is done by allowing any `*.lovable.app` subdomain, which covers both the published site and the preview environment.

### Files to Update
1. `supabase/functions/admin-list-users/index.ts`
2. `supabase/functions/admin-delete-user/index.ts`
3. `supabase/functions/admin-reset-password/index.ts`
4. `supabase/functions/generate-reset-link/index.ts`
5. `supabase/functions/send-welcome-email/index.ts`
6. `supabase/functions/parse-scorecard/index.ts`

### Technical Details
In each file, replace the strict origin check:
```typescript
const allowedOrigins = ["https://fagsallday.com", "https://www.fagsallday.com", "https://fagsallday.lovable.app"];
const corsOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
```

With a check that also accepts any `*.lovable.app` subdomain:
```typescript
const allowedOrigins = ["https://fagsallday.com", "https://www.fagsallday.com", "https://fagsallday.lovable.app"];
const isAllowed = allowedOrigins.includes(origin) || origin.endsWith(".lovable.app");
const corsOrigin = isAllowed ? origin : allowedOrigins[0];
```

This keeps the existing production domains and adds safe support for preview/development URLs.

