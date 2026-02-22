

## Fix: Infinite Recursion in RLS Policies (Rounds Not Loading)

### What Happened
Josh's past rounds are still safely in the database (4 rounds found). The problem is a circular RLS policy:

1. The `rounds` table has a policy: "Participants can view rounds they played in" which does `EXISTS (SELECT 1 FROM round_participants WHERE ...)`
2. The `round_participants` table has a policy: "Round owners can view participants" which does `EXISTS (SELECT 1 FROM rounds WHERE ...)`
3. Postgres detects this as infinite recursion and returns a 500 error on every query to `rounds`

### Fix
Replace the problematic RLS policy on `round_participants` ("Round owners can view participants") with one that does NOT reference the `rounds` table. Instead, use a security-definer helper function to check round ownership without triggering RLS recursion.

**Database migration:**

1. Drop the recursive policy on `round_participants`: "Round owners can view participants"
2. Drop the recursive policy on `round_participants`: "Round owners can insert participants"
3. Drop the recursive policy on `round_participants`: "Round owners can delete participants"
4. Create a `SECURITY DEFINER` function `is_round_owner(round_id uuid)` that checks `rounds.user_id` directly (bypasses RLS)
5. Re-create the three policies using the new function instead of a subquery on `rounds`

No code changes needed -- once the RLS recursion is fixed, the existing `useRounds.tsx` fetch will work and Josh's 4 rounds will appear again.

### Technical Details

```sql
-- Helper function (security definer bypasses RLS, breaking the cycle)
CREATE OR REPLACE FUNCTION public.is_round_owner(_round_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.rounds
    WHERE id = _round_id AND user_id = auth.uid()
  );
$$;

-- Drop recursive policies
DROP POLICY IF EXISTS "Round owners can view participants" ON round_participants;
DROP POLICY IF EXISTS "Round owners can insert participants" ON round_participants;
DROP POLICY IF EXISTS "Round owners can delete participants" ON round_participants;

-- Re-create using the helper function
CREATE POLICY "Round owners can view participants"
  ON round_participants FOR SELECT
  USING (public.is_round_owner(round_id));

CREATE POLICY "Round owners can insert participants"
  ON round_participants FOR INSERT
  WITH CHECK (public.is_round_owner(round_id));

CREATE POLICY "Round owners can delete participants"
  ON round_participants FOR DELETE
  USING (public.is_round_owner(round_id));
```

