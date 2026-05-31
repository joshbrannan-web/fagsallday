## Goal

When someone submits the public Tournament Registration form and the email is not yet tied to a fagsallday.com account, automatically:

1. Create a Supabase Auth user with that email.
2. Seed their `profiles` row with `display_name`, `handicap_index`, and (if provided) `ghin_number` / `ghin_last_synced` from the registration form.
3. Send a branded welcome email containing a one-time link that lets them set their password and land in the app.
4. Link the new `auth.users.id` back onto the `tournament_registration_entries` row so the existing approval / sync-to-tournament flow associates the entry with the real user.

If the email already maps to an existing account, skip user creation and skip the welcome email — just stamp `user_id` on the entry.

## What you may be missing

- **Duplicate email handling.** Re-registering with an existing email must NOT create a second account or re-trigger the welcome email (abuse + confusion). Plan: look up by email, link entry to existing `user_id`, send nothing.
- **Profile fields beyond handicap.** Carry over `display_name` (from Full Name), `handicap_index`, and `ghin_number` + `ghin_last_synced` (when the GHIN dropdown was used). Phone is not on `profiles` today — out of scope unless you want a schema change.
- **Where the "set password" link lands.** Auth.tsx already handles `type=recovery` and shows a "set new password" form. We will generate a `recovery` link (via Supabase Admin `generateLink`) pointing to `${origin}/#/auth` so users hit the existing flow with no new page needed.
- **Server-side only.** The current insert into `tournament_registration_entries` happens client-side with the anon key. Account creation requires the service role, so it must run in an Edge Function. We'll move the entry insert into a new public Edge Function so the whole thing is one atomic, rate-limited server call.
- **Avoiding email-enumeration & abuse.** The new Edge Function will be rate-limited per IP and per email (same pattern as `send-welcome-email` / `generate-reset-link`).
- **Approval flow continuity.** `sync-approved-to-tournament` already reads `user_id` off the entry — once we backfill it during registration, no change is needed there.

## Implementation

### New Edge Function: `submit-tournament-registration` (public, `verify_jwt = false`)

Inputs: full entry payload + `origin` (for the link host).

Flow:
1. Validate payload (Zod-style guards — name/email length, GHIN regex, handicap range).
2. Per-IP + per-email rate limit (in-memory, mirror `send-welcome-email`).
3. Insert the row into `tournament_registration_entries` using the service-role client.
4. Look up `auth.users` by email via `admin.listUsers({ email })`.
   - **Found:** set `entry.user_id = existing.id` and return success. No email sent.
   - **Not found:**
     a. `admin.createUser({ email, email_confirm: true, user_metadata: { display_name, handicap_index } })` — the existing `handle_new_user` trigger creates the `profiles` row with display name + handicap.
     b. If GHIN was provided, `profiles.update({ ghin_number, ghin_last_synced })` for the new user.
     c. `admin.generateLink({ type: 'recovery', email, options: { redirectTo: '${origin}/#/auth' } })` to get a password-set URL.
     d. Send welcome email via Resend (reuse template style from `send-welcome-email`) with subject "Welcome to FagsAllDay — set your password" and a CTA pointing to the recovery link.
     e. Update the entry row with `user_id = new.id`.
5. Fire-and-forget the existing Google Sheets sync (`sync-registration-to-sheets`).
6. Return `{ ok: true, accountCreated: boolean }`.

### Frontend: `src/pages/TournamentRegistration.tsx`

- Replace the direct `supabase.from('tournament_registration_entries').insert(...)` + sheets-invoke block with a single `supabase.functions.invoke('submit-tournament-registration', { body: { entry, origin: window.location.origin } })`.
- Confirmation screen wording: if `accountCreated`, add a line — "We've also created your FagsAllDay account — check your email to set a password."

### No DB migration required.

`profiles` already has `display_name`, `handicap_index`, `ghin_number`, `ghin_last_synced`. `tournament_registration_entries.user_id` already exists and is what the approval flow consumes.

### Files

- New: `supabase/functions/submit-tournament-registration/index.ts`
- Edit: `supabase/config.toml` — add `[functions.submit-tournament-registration] verify_jwt = false`
- Edit: `src/pages/TournamentRegistration.tsx` — swap insert for function invoke; tweak confirmation message.

### Out of scope (call out, don't build)

- Persisting phone to the user's profile (no column today).
- Welcome-email branding/templating beyond reusing the existing Resend pattern.
- Auto-confirming the email at sign-in time — `email_confirm: true` on createUser means the recovery link logs them straight in to set a password, no separate verification email.
