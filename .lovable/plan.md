

# Fix Audit Items #22, #23, #38

## Item #22 — PlayerListAdmin handicap override badge styling

**Current state:** Line 92 uses `bg-[hsl(var(--brand-gold))]/10 text-[hsl(var(--brand-gold))] border-[hsl(var(--brand-gold))]/30` and text says "Override".

**Fix:** Change badge classes to `bg-amber-500/20 text-amber-400 border border-amber-500/30` and text to "HCP Override".

**File:** `src/components/tournament-admin/PlayerListAdmin.tsx` (line 92-94)

## Item #23 — TeamListAdmin player reassignment

**Current state:** Already has a Select dropdown per player (line 50) that calls `onUpdatePlayer(p.id, { team_id: v })`. The flow is complete — selecting a new team calls the parent's update handler which writes to Supabase, and React re-renders the list since players are filtered by `team_id` per team card.

**Status:** Working as-is. The Select dropdown shows team options with color dots. No changes needed — the flow is end-to-end complete.

## Item #38 — Step 5 team assignment locking

**Current state:** `TournamentTeamAssigner` shows player names in read-only cards grouped by team. No dropdowns exist (good). But no lock icon on the current user's row.

**Fix:** Pass `currentUserId` to `TournamentTeamAssigner`. In the player card, if `p.user_id === currentUserId`, show a Lock icon + "You" badge. This requires the `TournamentPlayer` interface in TournamentTeamAssigner to include `user_id`.

**Files:**
- `src/components/tournament/TournamentTeamAssigner.tsx` — add `currentUserId` prop, add `user_id` to interface, render Lock icon
- `src/components/tournament/TournamentBuildRoundWizard.tsx` — pass `currentUserId` to TournamentTeamAssigner

