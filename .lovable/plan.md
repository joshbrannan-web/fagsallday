

# Fix: Pairing Count Shows Wrong Number on Dashboard

## Problem
On line 315 of `TournamentAdminDashboard.tsx`, the `pairingCount` is calculated by filtering groups with `status === 'pending'`. This means any group that has been started (status `active` or `submitted`) is excluded from the count. So if Round 1 has 2 groups but one is active, the button shows "1 Groups" instead of "2 Groups".

## Fix
One line change in `src/pages/TournamentAdminDashboard.tsx` (line 315):

Change:
```typescript
const pairingCount = roundGroups.filter((g: any) => g.status === 'pending').length;
```
To:
```typescript
const pairingCount = roundGroups.length;
```

This uses `roundGroups` (already filtered to the current round on line 313) to show the total number of pre-set groups, regardless of their status. The button will correctly show "Set Pairings (2 groups)" even when some groups are active or submitted.

