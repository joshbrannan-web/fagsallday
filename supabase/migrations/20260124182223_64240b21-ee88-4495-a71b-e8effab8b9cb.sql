-- Add DELETE policy to profiles table so users can delete their own profile data
CREATE POLICY "Users can delete their own profile"
ON public.profiles
FOR DELETE
USING (auth.uid() = id);