## Problem

Deleting a registrant fails because the `delete-registration` edge function is returning **404 Not Found**. The function source exists at `supabase/functions/delete-registration/index.ts`, but it has never been deployed (confirmed via edge logs — only OPTIONS preflight requests, all 404).

The frontend code (`TournamentRegistrationAdmin.tsx` → `handleDelete`) and the function source itself are both correct. The only issue is deployment.

## Plan

1. Deploy the `delete-registration` edge function so it's available at `/functions/v1/delete-registration`.
2. Verify by calling it once via the curl tool to confirm a non-404 response.
3. As a small UX upgrade, replace the native `confirm(...)` in `handleDelete` with the project's standard `AlertDialog` pattern (per project memory: "Use AlertDialog over window confirm"). Optional — can skip if you'd rather keep this minimal.

## Technical notes

- Root cause confirmed via `function_edge_logs`: every request to `delete-registration` returns 404, including OPTIONS preflight, which means the function isn't deployed.
- The required secrets (`GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`) are all already configured.
- The DB function `decrement_sheet_row_index` it depends on already exists.
