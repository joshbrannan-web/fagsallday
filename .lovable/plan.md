

## Allow Linked Players to View Active Rounds (Read-Only Scorecard)

### Overview

When a linked player logs in and someone else has started a round they're participating in, they'll see a "View Active Round" button on the home screen. Tapping it takes them directly to a **read-only Scorecard page** -- no hole-by-hole view, no editing. The only action available is "Return to Home".

### Changes

#### 1. Database: Enable realtime on `rounds` table

Run a migration so the Supabase realtime client can push live score updates to viewers:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.rounds;
```

#### 2. Insert participants at round creation

**File: `src/hooks/useRounds.tsx`**

In `createRound`, call `insertRoundParticipants()` right after the round is successfully inserted (so linked players can see the round immediately, not just after it's finished/locked).

#### 3. Fetch shared ACTIVE rounds

**File: `src/hooks/useRounds.tsx`**

Change the shared rounds status filter from `['LOCKED', 'COMPLETE']` to `['ACTIVE', 'LOCKED', 'COMPLETE']` so linked players can see active rounds.

#### 4. Add realtime subscription for shared active rounds

**File: `src/hooks/useRounds.tsx`**

After fetching rounds, subscribe to Postgres changes on the `rounds` table for any shared ACTIVE round IDs. When an update arrives (score changes), merge updated data into state so the viewer sees live scores without refreshing.

#### 5. "View Active Round" button on Landing page

**File: `src/components/Landing.tsx`**

- Import `Eye` icon from lucide-react
- Check if any round in `roundHistory` has `isShared === true` and `status === 'ACTIVE'`
- If so, show a "View Active Round" button (with Eye icon, distinct styling) between "Resume Round" and "Start New Round"
- Clicking it calls `loadPastRound(sharedActiveRound)` and navigates to `/scorecard`

#### 6. Make Scorecard read-only for shared rounds

**File: `src/components/Scorecard.tsx`**

When `currentRound.isShared === true`:

- Show a banner at the top: "Viewing [Owner]'s Round -- Read Only"
- **Disable hole number clicks** in the table header (remove `onClick` and `cursor-pointer` styling) so the viewer cannot navigate into individual holes
- **Replace the bottom footer buttons** entirely: instead of "Share Image" + "Return to Hole" / "Round Complete", show only a single "Return to Home" button that navigates to `/`
- The scorecard grid, scores, and game totals remain fully visible (view-only)

#### 7. No changes to ActiveRound or RoundSummary for viewers

Since viewers go directly to `/scorecard` and their only exit is "Return to Home", they never reach the ActiveRound hole-by-hole view or RoundSummary page. No read-only guards are needed there.

### Technical Details

**Realtime subscription pattern (useRounds.tsx):**
```
useEffect -> identify shared ACTIVE round IDs
  -> subscribe to supabase channel 'shared-rounds'
  -> on postgres_changes UPDATE for those round IDs
  -> merge new scores/gameData/status into local state
  -> cleanup: unsubscribe on unmount or when IDs change
```

**Scorecard read-only check:**
```
const isReadOnly = currentRound?.isShared === true;
```

This single flag controls:
- Hole header click disabled
- Footer replaced with "Return to Home"
- Read-only banner shown

**RLS:** No changes needed -- participants can already SELECT rounds they're in via existing `round_participants` RLS policy. They cannot UPDATE since no UPDATE policy exists for non-owners.

