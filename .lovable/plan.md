

## GHIN Handicap Auto-Sync

### Overview
Allow users to link their USGA GHIN number to their profile. The app will use the GHIN number to look up their official Handicap Index and keep it automatically in sync. Users can refresh on demand or have it sync when setting up a round.

### How It Works
Since the GHIN API is not publicly open (requires vendor approval from USGA), we will use the GHIN mobile app's internal API endpoints to look up golfer data. This requires a GHIN user account to authenticate. Rather than asking every user for their GHIN login, we will:

1. Store each user's GHIN number in their profile
2. Create a backend function that authenticates with GHIN's API using a shared GHIN account, then looks up the golfer's handicap by GHIN number
3. Sync the handicap to the user's profile automatically

A GHIN account (email + password) will be needed as a secret to authenticate API calls. This is the same approach used by other golf apps that wrap the unofficial GHIN API.

### Changes

#### 1. Database Migration
Add a `ghin_number` column to the `profiles` table:
- `ghin_number TEXT NULL` -- stores the user's 7-digit GHIN number
- `ghin_last_synced TIMESTAMPTZ NULL` -- tracks when handicap was last synced from GHIN

#### 2. New Edge Function: `sync-ghin-handicap`
Creates `supabase/functions/sync-ghin-handicap/index.ts` that:
- Accepts a `ghin_number` in the request body
- Authenticates with the GHIN API using stored credentials (`GHIN_EMAIL` and `GHIN_PASSWORD` secrets)
- Calls `https://api.ghin.com/api/v1/golfer_login.json` to get an auth token
- Calls `https://api.ghin.com/api/v1/golfers/search.json?golfer_id={ghin_number}` to fetch the golfer's current Handicap Index
- Returns the official handicap index
- Optionally updates the user's profile directly
- Includes JWT verification and rate limiting (10 lookups/hour per user)

#### 3. Update Profile Page (`src/pages/Profile.tsx`)
- Add a "GHIN Number" input field (7-digit number)
- Add a "Sync from GHIN" button that calls the edge function
- Show sync status: last synced timestamp, verified badge when linked
- When GHIN number is saved and synced, the handicap input becomes read-only with a note "Synced from GHIN"
- Allow users to disconnect GHIN (clears ghin_number, makes handicap editable again)

#### 4. Update Auth Hook (`src/hooks/useAuth.tsx`)
- Add `ghin_number` and `ghin_last_synced` to the `Profile` interface
- Include these fields in `fetchProfile` and `updateProfile`

#### 5. Auto-Sync at Round Setup (`src/components/SetupWizard.tsx`)
- When a round is being set up, check if the current user has a GHIN number linked
- If the last sync was more than 24 hours ago, automatically trigger a background sync
- Update the player's handicap silently

### Secrets Required
Two new secrets will need to be configured:
- `GHIN_EMAIL` -- Email address for a GHIN account used for API authentication
- `GHIN_PASSWORD` -- Password for the GHIN account

You will need a valid GHIN account (any golfer account works) to authenticate API lookups. This is the same account you use to log into ghin.com.

### Technical Details

**GHIN API Flow:**
1. `POST https://api.ghin.com/api/v1/golfer_login.json` with `{ user: { email_or_ghin, password } }` -- returns a bearer token
2. `GET https://api.ghin.com/api/v1/golfers/search.json?golfer_id={ghin_number}&status=Active` with `Authorization: Bearer {token}` -- returns golfer data including `handicap_index`

**Profile Page UI:**
- New section below the existing Handicap Index field
- Shows "Link GHIN" with an input for the 7-digit GHIN number
- Once linked: shows a green verified badge, the official handicap, last sync time, and a refresh button
- "Disconnect GHIN" link to unlink

**Edge function pattern:** Follows the same auth/CORS/rate-limit pattern as existing admin functions (JWT verification, dynamic CORS origin checking, in-memory rate limiting).

**Database migration:**
```sql
ALTER TABLE public.profiles 
ADD COLUMN ghin_number TEXT NULL,
ADD COLUMN ghin_last_synced TIMESTAMPTZ NULL;
```
