

## Confirmation: Plan Is Safe for Mid-Round Sign-Out

### Why no data is lost

For **authenticated users** (the only users who can sign out):
- The active round is persisted in the database with `status = 'ACTIVE'`
- Clearing `fg_current_round` and `fg_offline_round` from localStorage only removes **local caches**
- On sign-back-in, `useRounds.fetchRounds()` queries the database, finds the `ACTIVE` round, and restores it as `currentRound` automatically

The localStorage keys are just acceleration/offline caches — the database is the source of truth.

### Updated plan (unchanged from before)

**1. Clear all local round caches on sign-out** (`src/hooks/useAuth.tsx` → `signOut`)

Add these lines alongside existing cleanup:
- `localStorage.removeItem('fg_current_round')`
- `localStorage.removeItem('fg_history')`
- `localStorage.removeItem('fg_saved_courses')`

(`offlineStorage.clearCachedRound()` was already added in the last edit.)

No other changes needed — the existing database fetch on login handles round restoration.

