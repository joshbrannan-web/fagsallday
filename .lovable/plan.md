

## Plan: Share Round Link with Auto-Login (Linked) + Sign-Up Invite (Unlinked)

### Overview
The round owner taps "Share Round Link" to generate a shareable message. **Linked players** get a magic-link URL that auto-signs them in and redirects to the scorecard. **Unlinked players** get an invite URL that takes them to the sign-up page; after signing up, they see the active round and are automatically linked to the other players in the round.

### Changes

**1. New Edge Function: `supabase/functions/generate-round-links/index.ts`**
- Accepts `{ round_id }`, authenticates caller as round owner
- For each player in `players_data`:
  - **If `linkedUserId` exists**: use `auth.admin.getUserById()` → `auth.admin.generateLink({ type: 'magiclink', redirectTo: productionUrl/#/scorecard })` → personalized magic link
  - **If no `linkedUserId`**: generate a generic invite URL: `productionUrl/#/auth?mode=signup&round_id={round_id}&player_name={encodedName}` — no admin API needed
- Returns formatted share text with all players' links

**2. Database: `pending_round_links` table**
- Columns: `id`, `round_id`, `player_name`, `claimed_by` (nullable uuid), `owner_user_id`, `created_at`, `expires_at`
- RLS: owner can insert/select; authenticated users can select by `round_id` and update `claimed_by` where it's null
- When the edge function generates an invite for an unlinked player, it inserts a row into this table
- After a new user signs up and lands on the app, check this table for pending links matching their `round_id` param

**3. Post-signup auto-link logic: `src/components/Landing.tsx` or `src/App.tsx`**
- On mount, check URL for `round_id` + `player_name` query params (persisted in localStorage during signup flow)
- If user just signed up and these params exist:
  1. Query `pending_round_links` for matching `round_id` + `player_name` where `claimed_by` is null
  2. Update `claimed_by` to current user's ID
  3. Call `link_players_bidirectional` to auto-link with the round owner
  4. The round should now appear in their `round_participants` / shared rounds
  5. Navigate to scorecard

**4. Auth page: `src/pages/Auth.tsx`**
- Read `round_id` and `player_name` from URL params
- Persist them to `localStorage` before signup (so they survive the email verification redirect)
- Pre-fill display name from `player_name` if provided
- After successful signup + email verification, redirect includes these params

**5. UI: `src/components/ActiveRound.tsx`**
- Add "Share Round Link" button (visible when round is ACTIVE and has 2+ players)
- On tap: call edge function, then open `navigator.share()` with the text, or copy to clipboard as fallback
- Share text format:
  ```
  🏌️ Round started at [Course Name]!

  [LinkedPlayer], tap to view the live scorecard:
  [magic link]

  [UnlinkedPlayer], join us on F&Gs All Day:
  [signup invite link]
  ```

**6. Round participant creation for new signups**
- In the post-signup claim flow, after updating `pending_round_links.claimed_by`, also insert into `round_participants` so the new user can see the shared round
- Also create bidirectional saved_player links between the new user and the round owner (and other linked players)

### Files to create/modify
- **Create**: `supabase/functions/generate-round-links/index.ts`
- **Create**: DB migration for `pending_round_links` table + RLS policies
- **Modify**: `src/components/ActiveRound.tsx` — share button
- **Modify**: `src/pages/Auth.tsx` — read/persist round invite params, pre-fill name
- **Modify**: `src/components/Landing.tsx` or `src/App.tsx` — post-signup claim + auto-link flow

### Security
- Edge function validates caller is the round owner via JWT
- Magic links are one-time use, expire in 24h
- `pending_round_links` rows expire after 24h; `claimed_by` prevents double-claim
- RLS ensures only the owner can create pending links, and users can only claim unclaimed ones

