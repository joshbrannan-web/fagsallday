

# Fix: Infinite Recursion in tournament_groups RLS

## Problem
When a player starts a round (updating `tournament_groups.status` to `'active'`), the UPDATE policy on `tournament_groups` runs a direct subquery against `tournament_group_players`. The SELECT policy on `tournament_group_players` then queries back to `tournament_groups` — causing infinite recursion.

## Root Cause
The "Members can update own groups" UPDATE policy on `tournament_groups` uses an inline subquery:
```sql
EXISTS (SELECT 1 FROM tournament_group_players tgp JOIN tournament_players tp ...)
```
This triggers RLS on `tournament_group_players`, whose SELECT policy joins back to `tournament_groups`.

## Fix
Replace the inline subquery in the UPDATE policy with the existing `is_group_member(id)` SECURITY DEFINER function, which bypasses RLS and breaks the recursion cycle.

### Database Migration
```sql
DROP POLICY "Members can update own groups" ON public.tournament_groups;

CREATE POLICY "Members can update own groups"
ON public.tournament_groups
FOR UPDATE
TO authenticated
USING (is_group_member(id));
```

**1 migration, no code changes.**

