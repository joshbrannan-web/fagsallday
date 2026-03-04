
DROP POLICY "Members can view tournaments they joined" ON public.tournaments;

CREATE POLICY "Authenticated users can lookup tournaments"
ON public.tournaments
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);
