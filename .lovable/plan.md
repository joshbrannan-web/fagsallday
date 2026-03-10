

# Fix: Auto-Activate Tournament When Round Becomes Active

## Problem
The tournament remains in `setup` even though a round is `active`. The auto-activate logic only runs inside `startRound()` in the player wizard, and it fails silently if the user isn't the tournament creator (RLS restriction). There's also no catch-up mechanism on the admin dashboard.

## Solution
Two fixes:

### 1. Admin Dashboard: auto-promote on load
In `src/pages/TournamentAdminDashboard.tsx`, after the tournament detail data loads, check if any round has status `active` but the tournament is still `setup`. If so, update the tournament to `active` automatically. The admin viewing the dashboard IS the creator, so RLS will succeed.

```typescript
// In useEffect after data loads
if (tournament.status === 'setup' && rounds.some(r => r.status === 'active')) {
  await supabase.from('tournaments').update({ status: 'active' }).eq('id', tournament.id);
  // refresh local state
}
```

### 2. Keep existing startRound auto-activate (no change needed)
The existing code in `useTournamentRoundSetup.ts` lines 359-365 is fine as a best-effort. The dashboard fix above serves as the reliable catch-up.

## Files Changed
1. **`src/pages/TournamentAdminDashboard.tsx`** — Add useEffect to auto-promote tournament status when active rounds are detected

