# Sign-in option on the tournament registration page

Give registrants two ways to start: fill out the form manually, or sign in with their existing account so their details are pulled in automatically.

## What the registrant sees

At the top of the Register card, a small chooser:

```text
Already have an account?  [ Sign in ]        or just fill out the form below
```

- **Sign in** expands an inline email + password form (no page navigation, the registration page and its share code are preserved). A "Forgot password?" link points at the existing reset flow.
- On success, the card collapses back to the normal form with a green "Signed in as name (email)" line and a "Use a different account" link that signs out.
- If the visitor is already signed in when they open the link, the same signed-in state shows immediately (this already partly happens today).

## What gets pulled in after sign in

From the account profile: display name, email, GHIN number, handicap index. Name and email are prefilled and shown read-only (with a small "edit" affordance in case they register on behalf of a slightly different name).

## Asking for what's still missing

After sign in, only the fields the account can't supply stay open and are marked required-ish:

- Phone — always asked (not stored on the account today).
- Handicap — if the account has a GHIN, the GHIN field is prefilled and auto-synced so the index appears without any clicking. If the account has neither GHIN nor handicap, the Handicap selector stays empty for them to choose GHIN or Manual.
- Payment section — unchanged, shown only when the event requires payment.

A short "Just a few more details" heading separates the pulled-in summary from the remaining questions, so it's obvious what still needs input.

## Submission behavior

Unchanged path: the entry is submitted through the existing registration function with `user_id` set to the signed-in account, so no duplicate account is created and no Welcome Email is sent to an existing user — they get the registration confirmation email only. Guests who fill out the form manually keep today's behavior (account creation + combined welcome/registration email).

## Technical notes

- All work is in `src/pages/TournamentRegistration.tsx`; no backend or schema changes.
- Sign-in uses `supabase.auth.signInWithPassword`; sign-out uses `supabase.auth.signOut`. Errors surface as inline text plus a toast.
- The existing profile-prefill effect is extended to also trigger the GHIN auto-sync when the profile has a GHIN but no fresh index, reusing `syncGhin(ghin, true)`.
- Prefill only overwrites empty fields, so anything the registrant already typed before signing in is preserved.
