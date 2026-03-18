

# Fix Shared Active Round Auto-Set in `useRounds.tsx`

## Problem
When `loadedRoundIdRef` is null (user navigated home), the auto-set logic in `fetchRounds()` and `clearLoadedRound()` filters out shared rounds with `&& !r.isShared`. This means a non-owner participant never gets a shared active round auto-set as `currentRound` after a re-fetch.

Note: `insertRoundParticipants()` is already called in `createRound()` (line 221), so the RLS issue is already resolved.

## Fix
Update 3 locations in `src/hooks/useRounds.tsx` where the active round fallback excludes shared rounds:

**Lines 135-136** (inside `fetchRounds`, when loaded round not found):
```typescript
const activeRound = allRounds.find(r => r.status === 'ACTIVE' && !r.isShared)
                 || allRounds.find(r => r.status === 'ACTIVE' && r.isShared);
```

**Lines 139-140** (inside `fetchRounds`, when no loaded round ref):
Same change.

**Line 361** (inside `clearLoadedRound`):
Same change.

**1 file changed**: `src/hooks/useRounds.tsx` — 3 lines updated with shared-round fallback logic.

