

## Issues Found During Code Review

### 1. RLS Policy Gap — Tournament SELECT for Join Flow
When a user tries to join via code, the `joinTournament` function queries `tournaments` by `join_code`. But the RLS policies only allow SELECT if you're the creator OR already a participant. A new user trying to join can't see the tournament to look it up by code. This will cause "Tournament not found" errors for every join attempt.

**Fix**: Add a permissive SELECT policy on `tournaments` that allows any authenticated user to find a tournament by `join_code`, or use a database function with `SECURITY DEFINER` to handle the join lookup.

### 2. RLS Policy — Scorekeeper UPDATE Conflict
The `tournament_rounds` table has restrictive (`RESTRICTIVE`) policies. The scorekeeper UPDATE policy and creator ALL policy are both restrictive, meaning they must ALL pass. A scorekeeper who isn't the creator will fail because the creator policy won't pass for them.

**Fix**: Change the scorekeeper UPDATE policy to `PERMISSIVE` (or change both to permissive) so that either the creator OR the scorekeeper can update.

### 3. Tournament List Page — Missing Auth Guard
`TournamentList` calls `navigate('/auth')` during render if no user, which is a side effect during render (React anti-pattern). Should use a proper redirect or guard.

### 4. Missing Tournament Button on Landing Page
Need to verify the Landing page actually has the Tournament Mode entry point.

---

### Implementation Steps

1. **Fix RLS join-flow policy** — Add a database function `join_tournament_by_code(code text)` with `SECURITY DEFINER` that looks up the tournament and inserts the player, bypassing the SELECT restriction. OR add a permissive SELECT policy: `USING (true)` for authenticated users (tournaments table has no sensitive data).

2. **Fix RLS policy types** — Change `tournament_rounds` policies from RESTRICTIVE to PERMISSIVE so scorekeeper OR creator can update (not both required).

3. **Fix TournamentList auth redirect** — Move the navigation into a `useEffect`.

These are critical fixes — the tournament join flow and scorekeeper score entry will both fail without them.

