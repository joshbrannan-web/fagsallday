

# Plan: Fix Infinite Recursion in Tournament Group Players DELETE Policy

## Root Cause

The DELETE policy on `tournament_group_players` checks if the current user is a member of the same group by querying `tournament_group_players` itself:

```sql
EXISTS (
  SELECT 1 FROM tournament_group_players tgp2
    JOIN tournament_players tp ON tp.id = tgp2.tournament_player_id
  WHERE tgp2.tournament_group_id = tournament_group_players.tournament_group_id
    AND tp.user_id = auth.uid()
)
```

When Postgres evaluates the DELETE, it re-applies RLS to the inner `SELECT` on `tournament_group_players`, which triggers the same policy again — infinite recursion.

The same pattern also affects:
- `tournament_groups` DELETE policy (references `tournament_group_players`)
- `tournament_hole_results` DELETE policy (references `tournament_group_players`)
- `tournament_hole_scores` DELETE policy (references `tournament_group_players`)

All four DELETE policies query `tournament_group_players`, which has a self-referencing policy.

## Fix

Create a `SECURITY DEFINER` function that checks group membership without RLS, then update all four DELETE policies to use it.

### Step 1: Create helper function

```sql
CREATE OR REPLACE FUNCTION public.is_group_member(_group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM tournament_group_players tgp
    JOIN tournament_players tp ON tp.id = tgp.tournament_player_id
    WHERE tgp.tournament_group_id = _group_id
      AND tp.user_id = auth.uid()
  )
$$;
```

### Step 2: Replace the four DELETE policies

Replace each self-referencing policy with one that calls `is_group_member(tournament_group_id)` (or `is_group_member(id)` for `tournament_groups`).

| Resource | Change |
|---|---|
| Database migration | Create `is_group_member` SECURITY DEFINER function; drop and recreate DELETE policies on `tournament_group_players`, `tournament_groups`, `tournament_hole_results`, `tournament_hole_scores` |

0 code files changed, 1 database migration.

