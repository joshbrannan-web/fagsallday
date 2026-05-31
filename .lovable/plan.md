## Goal

When "None" is selected under **Link to Tournament** on the registration detail page, show a **Create Tournament** button that opens the Create Tournament wizard. After the tournament is created, automatically link it to this registration and return the admin to the registration page.

## Changes

### 1. `src/pages/TournamentRegistrationAdmin.tsx`
- Below the tournament `Select`, when `selectedConfig.tournament_id` is null, render a `Create Tournament` button.
- On click: `navigate('/tournament-admin/create?linkConfigId=' + selectedConfig.id)`.

### 2. `src/components/tournament-admin/CreateTournamentWizard.tsx`
- Read `linkConfigId` from `useSearchParams()`.
- If present, show a small banner at the top: "Will be linked to registration: <name>" (fetched once via Supabase). Cancelable via an X that strips the param.
- In `handlePublish`, after `createTournament(...)` returns the join code and before the `navigate(...)` call:
  - Fetch the new tournament id: `supabase.from('tournaments').select('id').eq('join_code', joinCode).maybeSingle()`.
  - If `linkConfigId` is set and we got an id, update the registration config:
    `supabase.from('tournament_registration_configs').update({ tournament_id: id }).eq('id', linkConfigId)`.
  - Then navigate to `/tournament-admin/registrations/<linkConfigId>` instead of `/tournament-admin`.
  - Toast: "Tournament created and linked to registration".

### Out of scope
- No backfill of any pre-existing approved registrants into the new tournament — admin can click the existing "Sync all approved to tournament" button after the redirect (we already built it). Optionally we can call it automatically; flagging as out of scope unless requested.
- No changes to the wizard's existing screens or validation.
- No changes to RLS (the registration config row is owned by the same user, so the direct `update` works).
