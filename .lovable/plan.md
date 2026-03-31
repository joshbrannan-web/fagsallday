

# Add "Create Google Sheet" Button for Configs Missing a Sheet

## Problem
This tournament registration config (`a5eea025-a60d-495b-a8af-17b01645c9ee`) has `google_sheet_url = null` — the sheet was never created (the edge function likely failed silently). The "Open Google Sheet" button only renders when the URL exists, so there's no way to retry or create one after the fact.

## Fix

### `src/pages/TournamentRegistrationAdmin.tsx`

In the detail view (line ~235), add an else branch: when `google_sheet_url` is null, show a "Create Google Sheet" button that:

1. Calls the `create-registration-sheet` edge function with the config name and admin email
2. On success, updates the `tournament_registration_configs` row with the returned `sheet_id` and `sheet_url`
3. Updates local state so the "Open Google Sheet" button appears immediately

```tsx
// Replace the existing google_sheet_url conditional block:
{selectedConfig.google_sheet_url ? (
  <Button asChild variant="outline" size="sm">
    <a href={selectedConfig.google_sheet_url} target="_blank">
      <ExternalLink className="w-4 h-4 mr-2" /> Open Google Sheet
    </a>
  </Button>
) : (
  <Button variant="outline" size="sm" onClick={handleCreateSheet}>
    <Plus className="w-4 h-4 mr-2" /> Create Google Sheet
  </Button>
)}
```

Add a `handleCreateSheet` function that invokes the edge function, updates the DB row, and refreshes `selectedConfig` in state.

Single-file change, no database modifications needed.

