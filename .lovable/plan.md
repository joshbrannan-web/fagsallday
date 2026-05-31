## Why "Test person" wasn't synced

I confirmed the problem against the live data:

- The registration entry exists (`74c61cb8-...`, status `approved`) but its `sheet_row_index` is `NULL`, meaning the row was never appended to the Google Sheet.
- The config has both a `google_sheet_id` and a valid `google_refresh_token`, so credentials are fine.
- The `sync-registration-to-sheets` edge function has **zero log entries** — it was never invoked.

### Root cause

In `supabase/functions/submit-tournament-registration/index.ts` (lines 332–339), the sheet sync is invoked fire-and-forget:

```ts
supabase.functions.invoke("sync-registration-to-sheets", { ... })
  .catch((err) => console.warn("Sheet sync failed:", err));
return new Response(...);
```

There is no `await` and no `EdgeRuntime.waitUntil(...)`. Deno Edge Runtime tears down pending async work the moment the handler returns its `Response`, so the invoke promise is killed before the HTTP call to the child function is even sent. That's why no logs exist for `sync-registration-to-sheets` and `sheet_row_index` stayed `NULL`.

## Fix

1. **Edit `supabase/functions/submit-tournament-registration/index.ts`** — wrap the sync invocation in `EdgeRuntime.waitUntil(...)` so it runs to completion after the response is sent (keeps the UX snappy and the dialog still pops immediately). Fallback to `await` if `EdgeRuntime` is unavailable.

2. **Backfill the missing row for "Test person"** — call `sync-registration-to-sheets` once directly (via `curl_edge_functions`) with `config_id` + the existing entry payload so the row appears in the sheet and `sheet_row_index` gets populated.

3. **Verify** — re-query `tournament_registration_entries` to confirm `sheet_row_index` is now set, and check `sync-registration-to-sheets` logs show a successful append.

No schema changes. No frontend changes. No new secrets.