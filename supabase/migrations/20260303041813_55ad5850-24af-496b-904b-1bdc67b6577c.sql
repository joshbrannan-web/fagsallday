CREATE POLICY "Tournament creator can delete their tournaments"
ON public.tournaments FOR DELETE
USING (created_by = auth.uid() AND is_tournament_admin());