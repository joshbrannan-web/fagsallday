## Goal
When a Google Sheet is created for a registration that already has signups, backfill all existing entries into the new sheet so admins don't lose visibility on prior registrants.

## Change: `supabase/functions/create-registration-sheet/index.ts`

After the sheet is created and `tournament_registration_configs` is updated with `google_sheet_id` / `google_sheet_url`, add a backfill step:

1. Query existing entries:
   ```ts
   const { data: entries } = await adminClient
     .from("tournament_registration_entries")
     .select("id, full_name, email, phone, handicap_index, ghin_number, payment_amount, payment_confirmed, status, created_at")
     .eq("config_id", config_id)
     .order("created_at", { ascending: true });
   ```

2. If `entries.length > 0`, map each to a row matching `HEADERS`:
   `[id, status || "Pending", full_name, email, phone, handicap_index?String:"", ghin_number, payment_amount?String:"", payment_confirmed?"Yes":"No", created_at]`

3. Append in one call:
   ```
   POST https://sheets.googleapis.com/v4/spreadsheets/{sheetId}/values/Registrations!A:J:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS
   body: { values: rows }
   ```

4. Parse `updates.updatedRange` to get the starting row index. Update each entry's `sheet_row_index` based on its position (start + i). Use a loop of `adminClient.from(...).update({ sheet_row_index }).eq("id", entry.id)`.

5. Wrap backfill in try/catch — log errors but still return success with `sheet_id` / `sheet_url`. Sheet creation succeeds even if backfill partially fails; future per-entry syncs via `sync-registration-to-sheets` continue to work for new signups.

## Out of scope
- No UI changes — button already flips to "Open Google Sheet" once `google_sheet_url` is set.
- No changes to `sync-registration-to-sheets` (new signups already append correctly).
- No retry/re-sync UI for failed backfills.
