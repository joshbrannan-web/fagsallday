

## Grant Tournament Admin — Temporary Setup Button

### The Problem
The `tournament_admins` table has RLS that only allows **app-wide admins** (users in `user_roles` with role `'admin'`) to insert rows. Based on the system memory, your account already has the app admin role, so a direct insert from the client will work.

### Plan
Add a "Grant Tournament Admin" button to the **Profile page** (`src/pages/Profile.tsx`), below the Save button. When clicked:

1. Check if user already has a row in `tournament_admins` (SELECT — allowed by the "Anyone can see if they are a tournament admin" policy)
2. If yes → toast "You are already a Tournament Admin"
3. If no → insert `{ user_id: user.id, granted_by: user.id }` (allowed by the "App admins can manage tournament admins" policy since your account has the admin role)
4. On success → toast "Tournament Admin status granted successfully"
5. On error → toast the error (in case the user doesn't have app admin role)

### Changes
- **`src/pages/Profile.tsx`** — Add a bordered section with a "Grant Tournament Admin" button after the Save button, with simple click handler using the Supabase client. Will be removed after confirmation.

No database changes needed. No new files.

