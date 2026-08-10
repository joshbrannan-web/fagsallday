# Auto-fetch handicap from GHIN on registration

Right now a registrant only gets a handicap if they press the Sync button (or type one manually). If they enter a GHIN and skip Sync, the entry is saved with no handicap.

## What changes

1. **Registration form auto-sync**: when the GHIN field contains a valid 5-9 digit number and the player leaves the field, look up the handicap automatically (same lookup the Sync button uses). The Sync button stays for manual retries.

2. **Server-side safety net**: on submit, if a GHIN is provided but no handicap came with it, the registration function performs the GHIN lookup itself before saving. The resulting handicap is written to the registration entry, the player's profile, and flows into the confirmation email and Google Sheet as it does today.

3. **Backfill for existing registrants**: entries that already have a GHIN but no handicap get filled in — a one-time pass over existing rows, plus the per-row Sync-to-Sheet action re-checks the GHIN and updates the handicap when it's missing.

If a GHIN lookup fails (bad number, service down), registration still succeeds with no handicap rather than blocking the player, and the form shows the lookup error.

## Technical notes

- `src/pages/TournamentRegistration.tsx`: run the existing `lookup-ghin-handicap` invoke on GHIN input blur/debounce, guarded so it doesn't re-fire for an already-synced number.
- `supabase/functions/submit-tournament-registration/index.ts`: after validating `ghin_number`, if `handicap_index` is null, call `lookup-ghin-handicap` server-side and use the result for the entry insert, profile update, email, and sheet sync.
- Backfill existing `tournament_registration_entries` rows where `ghin_number is not null and handicap_index is null` via the lookup, and add the same fallback to `sync-registration-to-sheets` before it writes the row.
