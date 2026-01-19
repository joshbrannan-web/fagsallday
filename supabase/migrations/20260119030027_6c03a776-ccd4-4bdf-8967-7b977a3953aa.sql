-- Replace the handle_new_user function with input validation and exception handling
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  safe_display_name TEXT;
  safe_handicap NUMERIC;
BEGIN
  -- Validate and sanitize display_name (limit to 100 characters)
  safe_display_name := COALESCE(
    LEFT(TRIM(NEW.raw_user_meta_data ->> 'display_name'), 100),
    LEFT(NEW.email, 100)
  );
  
  -- Validate and sanitize handicap_index with exception handling
  BEGIN
    safe_handicap := COALESCE(
      NULLIF(TRIM(NEW.raw_user_meta_data ->> 'handicap_index'), '')::numeric,
      0
    );
    -- Ensure handicap is within valid golf range (-10 to 54)
    IF safe_handicap < -10 OR safe_handicap > 54 THEN
      safe_handicap := 0;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- If conversion fails, default to 0
    safe_handicap := 0;
  END;
  
  INSERT INTO public.profiles (id, display_name, handicap_index)
  VALUES (
    NEW.id,
    safe_display_name,
    safe_handicap
  );
  RETURN NEW;
END;
$$;

-- Add a check constraint on profiles.display_name for additional safety
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_display_name_length_check'
  ) THEN
    ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_display_name_length_check
    CHECK (display_name IS NULL OR char_length(display_name) <= 100);
  END IF;
END $$;

-- Add a check constraint on profiles.handicap_index for valid range
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_handicap_index_range_check'
  ) THEN
    ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_handicap_index_range_check
    CHECK (handicap_index IS NULL OR (handicap_index >= -10 AND handicap_index <= 54));
  END IF;
END $$;