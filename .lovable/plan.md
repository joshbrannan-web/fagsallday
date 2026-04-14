

# Fix Share Round Links + Add Public Round Viewing

## Problems Identified

### 1. Magic links break with HashRouter
The edge function generates magic links with `redirectTo: "https://fagsallday.com/#/scorecard"`. Supabase's `generateLink` URL-encodes the `#`, turning it into `%23`. After authentication, the redirect goes to `fagsallday.com/%23/scorecard` which is a 404. This is the core reason linked-player links don't work.

### 2. No public round viewing for unlinked players
Unlinked players get sent to `/#/auth?mode=signup` with no option to just view the round. They must create an account first.

## Plan

### Step 1 — Fix magic link redirect (edge function)
In `generate-round-links/index.ts`, change the `redirectTo` for linked players to use a query-param-based redirect instead of a hash:
- Change: `redirectTo: "${PRODUCTION_URL}/#/scorecard"`
- To: `redirectTo: "${PRODUCTION_URL}/?redirect=scorecard"`

Then in the frontend, detect the `?redirect=scorecard` param on app load and navigate to `/#/scorecard`.

### Step 2 — Create a public Round Access page
Create `src/pages/RoundAccess.tsx` — a landing page for unlinked players that shows:
- Round info (course name, from the round_id)
- Two buttons: "Create Account to Get Access" and "View Round"
- "Create Account" navigates to `/auth?mode=signup&round_id=X&player_name=Y`
- "View Round" navigates to `/view-round/:roundId` (public read-only)

### Step 3 — Create a public View Round page
Create `src/pages/ViewRound.tsx` — a read-only scorecard viewer that:
- Fetches round data via a new edge function (since unauthenticated users can't query `rounds` table directly due to RLS)
- Displays scores in a simple read-only table
- Shows a banner prompting sign-up for full access

### Step 4 — New edge function: `get-public-round`
Create `supabase/functions/get-public-round/index.ts`:
- Accepts `round_id` + optional `token` (a short-lived sharing token)
- Uses service-role to fetch the round data
- Returns only safe fields: course, players (names only), scores, status
- Validates the round exists and has an active pending_round_link for that round_id (prevents random guessing)

### Step 5 — Update generate-round-links for unlinked players
Change invite URL from auth signup page to the new round access page:
- From: `${PRODUCTION_URL}/#/auth?mode=signup&round_id=X&player_name=Y`
- To: `${PRODUCTION_URL}/#/round-access/${round_id}?player_name=Y`

### Step 6 — Add redirect handler in App.tsx
In `AppContent`, add a useEffect that checks `window.location.search` for `?redirect=scorecard` on mount, and if found, navigates to `/scorecard` and cleans the URL.

### Step 7 — Register new routes
Add to `App.tsx`:
- `/round-access/:roundId` → `RoundAccess`
- `/view-round/:roundId` → `ViewRound`

## Files changed
- **Edit**: `supabase/functions/generate-round-links/index.ts` — fix redirectTo, change invite URL
- **New**: `supabase/functions/get-public-round/index.ts` — public round data endpoint
- **New**: `src/pages/RoundAccess.tsx` — choice page (Create Account / View Round)
- **New**: `src/pages/ViewRound.tsx` — public read-only scorecard
- **Edit**: `src/App.tsx` — add routes + redirect handler

