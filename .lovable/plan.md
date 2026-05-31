## Goal
Let registration admins delete their own registration configs (plus all entries and the linked Google Sheet). Restrict the registrations list so each admin only sees their own. Josh (`joshuajbrannan@gmail.com`, already has the `admin` app_role) sees and can delete everything.

## 1. Database migration

`tournament_registration_configs` currently has:
- "Creator full access" (created_by = auth.uid())
- "Public can read open registration configs" (is_open = true) — for the public registration page

Add a parallel "Super admin full access" policy so app admins bypass ownership:

```sql
CREATE POLICY "Super admin full access on registration configs"
ON public.tournament_registration_configs
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));
```

Same for `tournament_registration_entries` — add a super-admin policy that allows SELECT/UPDATE/DELETE for app admins:

```sql
CREATE POLICY "Super admin full access on registration entries"
ON public.tournament_registration_entries
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));
```

Josh already has `role = 'admin'` in `user_roles` — no data change needed.

Note: the existing "Creator full access" policy already scopes the admin list to `created_by = auth.uid()`, which already satisfies the "only see what I created" requirement. The new super-admin policy adds Josh's global access on top.

## 2. New edge function `delete-registration-config`

`supabase/functions/delete-registration-config/index.ts`:
- Validates Bearer JWT → `user`
- Loads the config row (id, created_by, google_sheet_id, google_refresh_token) with service role
- Authorizes if `config.created_by === user.id` OR caller has `admin` role (`user_roles` lookup)
- If `google_sheet_id` + `google_refresh_token` present: refresh Google token and `DELETE https://www.googleapis.com/drive/v3/files/{sheet_id}` (non-fatal on failure)
- `DELETE FROM tournament_registration_entries WHERE config_id = :id` (service role)
- `DELETE FROM tournament_registration_configs WHERE id = :id`
- Returns `{ success: true }`

Pattern mirrors existing `delete-registration` function (same CORS, same Google token refresh helper).

## 3. UI changes — `src/pages/TournamentRegistrationAdmin.tsx`

On the list view, each config card gets a Delete (trash) icon button in the top-right:
- `stopPropagation` so the card-level navigate doesn't fire
- Opens an `AlertDialog`: "Delete '{name}'? This permanently removes the registration page, all signups, and the linked Google Sheet. This cannot be undone."
- Confirm → `supabase.functions.invoke('delete-registration-config', { body: { config_id } })`
- On success: toast + remove from local `configs` state
- Show a spinner / disable while in-flight

No filtering changes needed in `loadConfigs()` — RLS already returns only the caller's configs (and everything for admins).

## Out of scope
- No changes to the public registration page or the existing per-entry delete.
- No tournament/round deletion when a config is linked to a tournament — only the registration data is removed (the linked tournament stays).
