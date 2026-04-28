# GHIN Connections Audit

## Goal
Verify every profile with a stored `ghin_number` actually resolves to that exact golfer in the GHIN API, and that the stored `handicap_index` matches what GHIN currently returns. Report any users with issues.

## Users to audit (13)
Austyn Whittenburg, Brandon Rodman, CB, Daniel Eskelson, Danny Laneri, Jake Larsen, John Boss, Josh Brannan, Justin Hamilton, Kevin Bene, Mau, Monroe McKay, Paul Rakovich.

## How the audit will work

A one-off Deno/Node script (run via `code--exec`, not added to the codebase) that:

1. Authenticates once to the GHIN API using the existing `GHIN_EMAIL` / `GHIN_PASSWORD` secrets (same flow as `sync-ghin-handicap`).
2. For each profile, calls `GET /api/v1/golfers/search.json?golfer_id=<ghin>&status=Active&per_page=10`.
3. Applies the same exact-match logic the edge function uses (`golfer_id` / `ghin_no` / `ghin_number` / `GHINNumber` / `ghin` / `id`).
4. Compares:
   - **Match found?** If no exact match → flagged as "Invalid / not found".
   - **Name check** — returned `first_name + last_name` vs profile `display_name` (loose token match). Mismatch → "Wrong golfer linked".
   - **Handicap drift** — returned `handicap_index` vs stored value. Difference > 0.1 → "Handicap out of date".
   - **Inactive / no index** — flagged separately.

## Output

A single table reported back in chat:

```text
User              GHIN       Status          Stored HCP   GHIN HCP   GHIN Name
----------------  ---------  --------------  -----------  ---------  ----------------
Josh Brannan      10988439   OK              11.4         11.4       Josh Brannan
...
CB                1902748    NAME MISMATCH   15.6         12.1       John Smith
```

Plus a short summary listing only the users with issues and the recommended action (re-link, refresh, or clear).

## Scope

- Read-only audit. **No** profile rows will be modified.
- No code added to the repo. The script lives in `/tmp` and is discarded.
- If a user is flagged, you decide whether to (a) clear their `ghin_number`, (b) prompt them to re-link, or (c) auto-refresh — I'll wait for direction before any writes.
