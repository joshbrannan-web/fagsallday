

## Show Linked Status in Saved Player Selection

### What Changes
When selecting from saved players during round setup, show a visual indicator (badge/icon) next to players who are linked to an app user account. This applies to both:

1. **The per-slot dropdown** ("Choose from saved players..." Select component) -- lines 1630-1640
2. **The "Saved Players" dialog** (opened via the UserPlus button) -- lines 1706-1723

### Technical Details

**1. Per-slot Select dropdown (line 1636-1638)**
Currently shows: `{sp.name} (HCP: {sp.handicap_index})`
Change to include a linked indicator: `{sp.name} (HCP: {sp.handicap_index}) [Linked]` or a small UserCheck icon text.

Since `SelectItem` only supports text content reliably, we will append a text indicator like " - Linked" when `sp.linked_user_id` is set.

**2. Saved Players dialog (lines 1712-1722)**
Currently shows name, handicap, and tee. Add a small `UserCheck` icon badge next to the player name when `sp.linked_user_id` is present, matching the style used elsewhere in the app.

### Files Modified
- `src/components/SetupWizard.tsx` -- Two small edits to the saved player display in the dropdown and dialog

