CREATE POLICY "Users can update their own saved courses"
  ON public.saved_courses
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);