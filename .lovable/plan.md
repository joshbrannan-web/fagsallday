

# Fix: Tournament Resume for Non-Owner Group Members

## Clarification
Each tournament group creates its own independent round record. Within a group, one player is the "owner" (starter) and the others are "participants" who see it as a shared round. Different groups have completely separate round records — this fix only affects how non-owner participants within the SAME group see their shared round on the home page.

## Problem
Non-owner group members see "View Active Round" (eye icon, navigates to `/scorecard`) instead of "Resume Tournament Round" (trophy icon, navigates to `/active` with tournament state).

## Fix

**File: `src/components/Landing.tsx`** — Lines 220-235 (shared active round block)

Check if the shared active round has `_TOURNAMENT_META` in its `gameData`:

- **If tournament round**: Show Trophy icon + "Resume Tournament Round" text, green success styling, navigate to `/active` with full tournament state (same as lines 206-207)
- **If regular shared round**: Keep existing "View Active Round" behavior (eye icon, `/scorecard`)

~10 lines changed in one file. No impact on other groups — each group has its own round record and this logic only triggers for the specific shared round the current user is a participant of.

