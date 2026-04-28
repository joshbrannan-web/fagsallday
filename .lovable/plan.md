# Nightly GHIN Auto-Refresh

## Goal
Every profile with a `ghin_number` gets its `handicap_index` and `ghin_last_synced` automatically refreshed once per day from the GHIN API — no user action required.

## Architecture

```text
pg_cron (4:00 AM UTC daily)
    │
    └─► HTTP POST → edge function: nightly-ghin-refresh
                        │
                        ├─ Authenticate to GHIN (shared account)
                        ├─ Pull all profiles WHERE ghin_number IS NOT NULL
                        ├─ For each: search.json → exact-match → update profile
                        └─ Log summary (count synced, drifted, failed)
```

## Pieces to build

### 1. Edge function `nightly-ghin-refresh`
- Reuses the same logic as `sync-ghin-handicap`:
  - GHIN login with `GHIN_EMAIL` / `GHIN_PASSWORD`
  - Strict exact-match on returned golfer (same `extractIds` logic — protects against the wrong-golfer bug we fixed earlier)
- Iterates every profile with a `ghin_number`, calls GHIN search, updates `handicap_index` + `ghin_last_synced` only on **valid exact match**.
- Skips (does not overwrite) any profile where:
  - GHIN API returns no exact match (avoids overwriting with stranger's data)
  - Returned `handicap_index` is missing/NaN
- Throttle: 250 ms between GHIN calls to be polite to the API.
- Auth: protected by a shared secret header (`x-cron-secret`) so only the cron job can invoke it. Not public, not user-JWT (cron has no user).
- Returns JSON summary: `{ total, updated, unchanged, skipped, errors }`.

### 2. New secret: `GHIN_CRON_SECRET`
A random token the cron job sends in the `x-cron-secret` header. The edge function rejects requests without it.

### 3. Enable extensions + cron schedule
- Enable `pg_cron` and `pg_net` (migration).
- Schedule via `cron.schedule(...)` using `net.http_post` to invoke the edge function daily at **04:00 UTC** (≈ overnight in US time zones, before any morning rounds).

## Safety & observability
- **Never overwrites** a handicap unless the GHIN API returns an exact-ID match. Same protection as the manual flow.
- Every run logs to edge function logs: per-user result + final summary, easy to inspect via the logs tool.
- If GHIN auth fails the entire job aborts cleanly and logs the error — no partial damage.
- Linked `saved_players` automatically pick up new values via the existing `get_saved_players_with_profiles` RPC, so no extra writes needed.

## Cost
~13 GHIN API calls/day today. Edge function runs in <30 s. Effectively free.

## Files
- `supabase/functions/nightly-ghin-refresh/index.ts` — new edge function
- DB migration — enable `pg_cron`, `pg_net`
- DB insert (data, not schema) — `cron.schedule(...)` with the function URL + secret

## Out of scope
- No UI changes. (Existing "Refresh GHIN" button in profile remains for instant updates.)
- No tournament/saved_player table writes — those derive from `profiles` already.
