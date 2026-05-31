## Goal

On the public Tournament Registration page (`src/pages/TournamentRegistration.tsx`):

1. Replace the separate "Handicap Index" and "GHIN #" fields with a single **Handicap** section that has a dropdown selector: **GHIN** or **Manual**.
2. Format the **Phone** field as a US phone number and cap entry at 10 digits.

## UI Changes — `src/pages/TournamentRegistration.tsx`

Remove the existing 2-column grid containing `r-hcp` and `r-ghin`. Replace with:

- A **Handicap Source** `<Select>` with two options: `GHIN` (default) and `Manual`.
- If **GHIN** selected:
  - `Input` for GHIN # (5–9 digits) + a **Sync** button.
  - Clicking Sync calls the GHIN lookup (see backend below). On success, populates a read-only handicap display and stores both `ghinNumber` and `handicapIndex` in form state.
  - Last-synced timestamp shown inline on success.
- If **Manual** selected:
  - `Input` (number, step 0.1, range -10 to 54) for handicap index. `ghinNumber` is cleared.

When the user is already logged in and the profile auto-fill loads a GHIN # + handicap, default the selector to **GHIN** and prefill both; otherwise default to **GHIN** with empty fields. Submission payload to `tournament_registration_entries` keeps the same `handicap_index` and `ghin_number` columns — only the input UX changes.

### Phone formatting

- Strip non-digits on each keystroke, cap at 10 digits, and display as `(XXX) XXX-XXXX` (partial masks while typing: `(XX`, `(XXX) XX`, etc.).
- Persist only the formatted string (matches current free-text column). `maxLength` becomes 14 (formatted length).

## Backend — GHIN lookup for anonymous users

The existing `sync-ghin-handicap` edge function **requires a logged-in JWT** and writes to `profiles`. The registration page is public (users may not be signed in), so we need a public lookup path.

Add a new edge function **`lookup-ghin-handicap`**:

- Public (no JWT required); configured with `verify_jwt = false` in `supabase/config.toml`.
- Input: `{ ghin_number: string }`.
- Performs the same GHIN API call as `sync-ghin-handicap` (reuse the lookup logic) and returns `{ handicap_index, full_name?, club? }`. **Does not** read or write any DB rows.
- Rate-limited by client IP (e.g. 10/hour) using the same in-memory pattern.
- CORS headers identical to other public functions.

The registration page's Sync button invokes this function via `supabase.functions.invoke('lookup-ghin-handicap', { body: { ghin_number } })`. No anon key handling beyond the default client.

## Technical Details

- Files edited:
  - `src/pages/TournamentRegistration.tsx` — form refactor, phone formatter helper, new state (`hcpSource: 'ghin' | 'manual'`, `ghinSyncing`, `ghinSyncedAt`).
  - `supabase/config.toml` — add `[functions.lookup-ghin-handicap] verify_jwt = false`.
- Files created:
  - `supabase/functions/lookup-ghin-handicap/index.ts` — extracted public GHIN lookup.
- No database migrations. No changes to admin pages, approval flow, or sheet sync — `handicap_index` and `ghin_number` fields on `tournament_registration_entries` are unchanged.
- Validation: GHIN must match `/^\d{5,9}$/` before Sync is enabled; Manual handicap kept in the existing -10..54 range.
- Phone helper: pure function `formatPhone(raw: string): string` (cap 10 digits, mask as US format).
