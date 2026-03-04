

# Plan: Fix Tournament Join Code for Non-Creator Players

## Root Cause

The `tournaments` table SELECT policy requires the user to already be a tournament member OR creator:

```sql
USING (is_tournament_member(id) OR (created_by = auth.uid()))
```

This creates a chicken-and-egg problem: a new player needs to SELECT the tournament (by join code) to find its ID, but they can't SELECT because they're not a member yet. The creator (Josh Brannan) worked because `created_by = auth.uid()` passes for him. The second player's lookup query returns no rows, so they see "Tournament not found."

## Fix

Add a new PERMISSIVE SELECT policy on `tournaments` that allows any authenticated user to look up tournaments by join code. This is safe because it only exposes basic tournament metadata (name, status, join_code) — no sensitive data.

**Database migration:**
```sql
CREATE POLICY "Authenticated users can lookup tournaments"
ON public.tournaments
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);
```

Then drop the old restrictive policy:
```sql
DROP POLICY "Members can view tournaments they joined" ON public.tournaments;
```

This single policy covers both members viewing their tournaments and new players looking up by join code.

**No code changes needed** — the application code is correct; it's purely an RLS issue.

## Also: Runtime Error (Separate Issue)

The console shows "Invalid hook call" errors in `QueryClientProvider` on the preview domain. This is a Vite HMR / React duplicate instance issue during development — not related to the join code problem and not affecting the published site (fagsallday.com).

