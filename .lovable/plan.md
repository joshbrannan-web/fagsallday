

# Add Team Colors to 1v1 Matchup UI

## Problem
The matchup assignment step and sub-matchup display in `RoundPairingsEditor` don't show team colors next to player names, making it hard for the admin to see which team each player belongs to.

## Changes

### `src/components/tournament-admin/RoundPairingsEditor.tsx`

Three areas need team color dots added:

1. **Match 1 Select dropdowns (lines 286-301)** — In each `SelectItem`, prepend a colored dot using the player's `team_id` → `getTeam()` lookup. Also update the `SelectTrigger` display to show the dot next to the selected player name.

2. **Match 2 auto-derived display (lines 310-317)** — Add a colored dot before each player name in the static display row.

3. **Sub-matchup display on existing group cards (lines 201-210)** — Add colored dots next to each player name (`pA` and `pB`) using their `team_id`.

All dots use the same pattern already used elsewhere in this file: `<span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: team.color }} />`

**1 file changed, no new dependencies.**

