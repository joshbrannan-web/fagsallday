Add a "Sync to Sheet" action per registrant on the admin page.

### Changes

1. **`supabase/functions/sync-registration-to-sheets/index.ts`** — accept `{ config_id, entry_id }` in addition to `{ config_id, entry }`. When `entry_id` is given, fetch the full entry row from `tournament_registration_entries` server-side using the service-role client (always uses current HCP, phone, GHIN, payment fields). Log Sheets API failures.

2. **`src/components/tournament-admin/RegistrationEntryList.tsx`** — add an optional `onSyncToSheet?: (entry) => Promise<void>` prop and a small RefreshCw icon button in the Actions column (shown when prop is provided), with `title="Sync to Google Sheet"`. Spinner during processing.

3. **`src/pages/TournamentRegistrationAdmin.tsx`** — add `handleSyncToSheet(entry)` that invokes `sync-registration-to-sheets` with `{ config_id: selectedConfig.id, entry_id: entry.id }`, shows a sonner toast on success/error, and passes it as `onSyncToSheet` to the list. Only render the button when the config has a `google_sheet_id` linked.

No schema changes, no new secrets. Future auto-sync on submit is unaffected.