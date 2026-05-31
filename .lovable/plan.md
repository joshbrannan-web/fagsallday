## Goal

1. After a player clicks **Submit Registration**, show a popup: *"You have Registered, you will receive an email with instructions."*
2. Always send a **registration confirmation email** containing:
   - "Congratulations, you have registered for **{Tournament Name}**."
   - "If you haven't already, please submit payment to {Venmo link}."
   - "Once confirmed you'll get an email from the Tournament Masters that you are all set."
3. **Existing accounts (matched by email):** receive the registration email only.
4. **Newly created accounts:** receive ONE combined email — the existing Welcome / Set‑Password content **plus** the registration confirmation section above. Never two emails.

## Frontend — `src/pages/TournamentRegistration.tsx`

- Replace the current inline "submitted" view swap with an `AlertDialog` modal that opens on successful `submit-tournament-registration` response.
  - Title: **You have Registered**
  - Body: *"You will receive an email with instructions."*
  - Single action button: **Close** → routes back to home (or to `/` / tournament list, matching today's behavior).
- Keep validation, error toasts, and Venmo button on the form itself untouched.

## Edge function — `supabase/functions/submit-tournament-registration/index.ts`

- After resolving `configId`, fetch from `tournament_registration_configs`: `name`, `venmo_link`, `amount`, `amount_label` (pass these to email rendering). Pass these in the request body from the client so we avoid an extra DB read; if not present, fall back to a server-side `select`.
- Build a reusable `registrationBlock` HTML snippet:
  ```
  Congratulations, you have registered for <strong>{tournamentName}</strong>.
  If you haven't already, please submit your {amount_label} of ${amount} via Venmo:
  [Pay via Venmo] (button → venmo_link)
  Once confirmed, you'll get an email from the Tournament Masters that you're all set.
  ```
  Only render the Venmo button when `venmo_link` exists.
- Email branching:
  - **`accountCreated === true`:** Replace today's welcome-email body so it contains BOTH the existing "Welcome / Set Your Password" block AND the `registrationBlock`. Subject: *"Welcome to F&Gs All Day — you're registered for {Tournament Name}"*. One email only.
  - **`accountCreated === false` (existing user):** Send a new email using only the `registrationBlock` (no password-set CTA). Subject: *"You're registered for {Tournament Name}"*. From the same `noreply@fagsallday.com` sender via Resend.
- Keep the existing rate-limit + Sheets sync flow. Failures to send email continue to be logged but do not fail the registration.

## Out of scope

- No DB schema changes.
- No change to the admin "approval" email — that remains the "Tournament Masters" follow-up the copy alludes to.
- No change to phone formatting / GHIN sync paths.

## Files

- Edit: `src/pages/TournamentRegistration.tsx` (popup + pass tournament_name/venmo/amount in invoke body).
- Edit: `supabase/functions/submit-tournament-registration/index.ts` (registration email for existing users, merged welcome+registration for new users, fetch/accept config fields).
