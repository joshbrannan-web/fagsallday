

## Plan: Fix Past Round Data Lost on Tab Switch

### Root Cause
When the user switches tabs and returns, the authentication session refreshes, which triggers `fetchRounds()` to re-run. Inside `fetchRounds`, the code always resets `currentRound` to the active round (status = 'ACTIVE') or null. Since the viewed round is COMPLETE, the loaded round gets wiped and the user sees "No Round Data".

### Solution
Track the manually-loaded round ID separately so it survives re-fetches. When `fetchRounds` completes, if the user had manually loaded a round (via "View Past Round"), restore that round from the freshly-fetched data instead of defaulting to the active round only.

---

### File: `src/hooks/useRounds.tsx`

**Change 1: Add a `loadedRoundId` ref to track manually-loaded rounds**

Add a `useRef` to remember when a user has explicitly loaded a past round:

```typescript
const loadedRoundIdRef = useRef<string | null>(null);
```

**Change 2: Update `fetchRounds` to preserve the loaded round**

After fetching rounds from the database, check if there is a manually-loaded round ID. If so, find that round in the fetched data and keep it as `currentRound` instead of wiping it:

```typescript
const fetchedRounds = (data || []).map(dbRoundToRound);
setRounds(fetchedRounds);

// Preserve manually-loaded round across refetches
if (loadedRoundIdRef.current) {
  const loadedRound = fetchedRounds.find(r => r.id === loadedRoundIdRef.current);
  if (loadedRound) {
    setCurrentRound(loadedRound);
  } else {
    // Round was deleted or no longer accessible — fall back
    loadedRoundIdRef.current = null;
    const activeRound = fetchedRounds.find(r => r.status === 'ACTIVE');
    setCurrentRound(activeRound || null);
  }
} else {
  // Default behavior: show active round
  const activeRound = fetchedRounds.find(r => r.status === 'ACTIVE');
  setCurrentRound(activeRound || null);
}
```

**Change 3: Update `loadRound` to set the ref**

```typescript
const loadRound = (round: Round) => {
  loadedRoundIdRef.current = round.id;
  setCurrentRound(round);
};
```

**Change 4: Clear the ref when navigating away from a past round**

Clear `loadedRoundIdRef` when creating a new round, finishing a round, or explicitly going home:

- In `finishRound`: add `loadedRoundIdRef.current = null;`
- In `createRound`: add `loadedRoundIdRef.current = null;`

Also expose a `clearLoadedRound` function so the Landing page can clear it when the user navigates home:

```typescript
const clearLoadedRound = () => {
  loadedRoundIdRef.current = null;
  const activeRound = rounds.find(r => r.status === 'ACTIVE');
  setCurrentRound(activeRound || null);
};
```

---

### File: `src/App.tsx`

- Destructure the new `clearLoadedRound` from `useRounds()`
- Pass it through `AppContext` so the Landing page and other components can call it when the user navigates home

---

### File: `src/contexts/AppContext.tsx`

- Add `clearLoadedRound` to the `AppState` interface

---

### File: `src/components/Landing.tsx`

- Call `clearLoadedRound()` when the Landing component mounts, so that returning to the home screen naturally clears the loaded round state

---

## Files Changed Summary

| File | Change |
|------|---------|
| `src/hooks/useRounds.tsx` | Add `loadedRoundIdRef`, update `fetchRounds` to preserve loaded round, update `loadRound`/`finishRound`/`createRound` to manage the ref, add `clearLoadedRound` |
| `src/contexts/AppContext.tsx` | Add `clearLoadedRound` to AppState interface |
| `src/App.tsx` | Wire `clearLoadedRound` through context |
| `src/components/Landing.tsx` | Call `clearLoadedRound` on mount |

---

## Why This Works

- The `useRef` persists across re-renders without triggering additional renders
- When the auth session refreshes on tab switch, `fetchRounds` re-runs but now checks for the loaded round ID first
- The loaded round is restored from the fresh database data (so it also picks up any server-side updates)
- Navigating home or starting a new round naturally clears the ref

