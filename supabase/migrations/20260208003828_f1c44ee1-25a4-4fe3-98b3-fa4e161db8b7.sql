
-- Create verified_courses table
CREATE TABLE public.verified_courses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_name TEXT NOT NULL,
  course_location TEXT NOT NULL DEFAULT '',
  course_data JSONB NOT NULL,
  verified_by UUID NOT NULL,
  verified_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  total_par INTEGER NOT NULL DEFAULT 72,
  total_yardage INTEGER NOT NULL DEFAULT 0
);

-- Create unique index on lowercase course name to prevent duplicates
CREATE UNIQUE INDEX idx_verified_courses_name_lower ON public.verified_courses (lower(course_name));

-- Enable Row Level Security
ALTER TABLE public.verified_courses ENABLE ROW LEVEL SECURITY;

-- SELECT: All authenticated users can read all verified courses
CREATE POLICY "Authenticated users can view all verified courses"
ON public.verified_courses
FOR SELECT
TO authenticated
USING (true);

-- INSERT: Authenticated users can insert rows where verified_by = auth.uid()
CREATE POLICY "Users can verify courses"
ON public.verified_courses
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = verified_by);

-- UPDATE: Only the user who verified can update their entry
CREATE POLICY "Users can update their own verified courses"
ON public.verified_courses
FOR UPDATE
TO authenticated
USING (auth.uid() = verified_by)
WITH CHECK (auth.uid() = verified_by);

-- DELETE: Only the user who verified or an admin can delete
CREATE POLICY "Users can delete their own verified courses"
ON public.verified_courses
FOR DELETE
TO authenticated
USING (auth.uid() = verified_by OR public.has_role(auth.uid(), 'admin'));
