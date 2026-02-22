

## Add GHIN Sync Option to Signup Flow

Replace the current static "Handicap Index" text field during signup with a choice: sync from USGA/GHIN or enter manually.

### User Experience

During account creation, after the "Your Name" field, the user will see a toggle/choice:

1. **"Sync from GHIN"** -- reveals a GHIN number input field. When the account is created, the app will automatically look up their handicap from USGA.
2. **"Enter Manually"** -- shows the existing handicap index number field (current behavior).

A small label like "Have a GHIN number?" with two buttons/tabs ("Yes, sync it" / "No, enter manually") keeps it simple and non-intimidating.

### How It Works

- If the user enters a GHIN number, the account is created with handicap 0, and the GHIN number is saved to their profile. The existing auto-sync logic (already in `useAuth.tsx`) will immediately sync the handicap on first sign-in.
- If they choose manual entry, it works exactly as it does today.

### Technical Details

**File: `src/pages/Auth.tsx`**

1. Add a new state variable `handicapMethod: 'ghin' | 'manual'` (default `'manual'`).
2. Add a new state variable `ghinNumber: string`.
3. Replace the current "Handicap Index (optional)" field in the signup section (lines 389-399) with:
   - A small toggle: "Have a GHIN number?" with two options ("Sync from USGA" / "Enter manually")
   - If `'ghin'`: show a GHIN number input field
   - If `'manual'`: show the existing handicap index input
4. Update `handleSubmit` (around line 188-200): if `handicapMethod === 'ghin'`, pass the GHIN number to `signUp` metadata so it gets saved to the profile.

**File: `src/hooks/useAuth.tsx`**

5. Update the `signUp` function to accept an optional `ghinNumber` parameter.
6. Include `ghin_number` in the `options.data` metadata passed to `supabase.auth.signUp`.

**File: `supabase/functions/sync-ghin-handicap/index.ts`** -- No changes needed. The existing `handle_new_user` trigger + auto-sync on sign-in will handle the rest automatically.

**Database trigger `handle_new_user`** -- needs a small update to also read `ghin_number` from `raw_user_meta_data` and save it to the profile, so the auto-sync can pick it up on first login.

### Migration (SQL)

Update the `handle_new_user` function to extract `ghin_number` from signup metadata:

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  safe_display_name TEXT;
  safe_handicap NUMERIC;
  safe_ghin TEXT;
BEGIN
  safe_display_name := COALESCE(
    LEFT(TRIM(NEW.raw_user_meta_data ->> 'display_name'), 100),
    LEFT(NEW.email, 100)
  );
  
  BEGIN
    safe_handicap := COALESCE(
      NULLIF(TRIM(NEW.raw_user_meta_data ->> 'handicap_index'), '')::numeric, 0
    );
    IF safe_handicap < -10 OR safe_handicap > 54 THEN
      safe_handicap := 0;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    safe_handicap := 0;
  END;

  safe_ghin := NULLIF(TRIM(NEW.raw_user_meta_data ->> 'ghin_number'), '');

  INSERT INTO public.profiles (id, display_name, handicap_index, ghin_number)
  VALUES (NEW.id, safe_display_name, safe_handicap, safe_ghin);
  RETURN NEW;
END;
$function$;
```

This is a 2-file code change + 1 database migration. The auto-sync feature already built into `useAuth.tsx` will handle fetching the handicap from USGA on first sign-in.
