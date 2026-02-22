

## Fix: Admin Portal CORS - Wrong Domain

### Problem
The previous CORS fix added support for `*.lovable.app` subdomains, but the preview environment actually uses `*.lovableproject.com` as its origin. The requests are coming from `https://902ceb91-...lovableproject.com`, which does not match `.lovable.app`, so they are still being blocked.

### Solution
Update all 6 backend functions to also accept `*.lovableproject.com` origins in addition to `*.lovable.app`.

### Files to Update
1. `supabase/functions/admin-list-users/index.ts`
2. `supabase/functions/admin-delete-user/index.ts`
3. `supabase/functions/admin-reset-password/index.ts`
4. `supabase/functions/generate-reset-link/index.ts`
5. `supabase/functions/send-welcome-email/index.ts`
6. `supabase/functions/parse-scorecard/index.ts`

### Technical Details
In each file, change the origin check from:

```typescript
const isAllowed = allowedOrigins.includes(origin) || origin.endsWith(".lovable.app");
```

To:

```typescript
const isAllowed = allowedOrigins.includes(origin) || origin.endsWith(".lovable.app") || origin.endsWith(".lovableproject.com");
```

This one-line change in each file adds the preview domain pattern while keeping all existing allowed origins intact.

