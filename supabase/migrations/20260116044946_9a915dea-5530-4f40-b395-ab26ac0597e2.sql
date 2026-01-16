-- Add is_favorite column to saved_courses table
ALTER TABLE public.saved_courses 
ADD COLUMN is_favorite boolean NOT NULL DEFAULT false;