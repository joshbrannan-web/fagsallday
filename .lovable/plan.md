

# Per-Admin Google OAuth for Sheets Integration

## Why it keeps failing
The `GOOGLE_SERVICE_ACCOUNT_KEY` secret is being stored in a format the edge function cannot parse -- despite multiple attempts. The Lovable secrets system likely mangles the multi-line JSON (escaping newlines in the private key, double-encoding, etc.). More parsing logic won't fix a platform-level storage issue.

The service-account model is also architecturally wrong for your use case: sheets end up owned by the service account, requiring fragile permission-sharing. Per-admin OAuth is the right long-term path.

## How it will work

1. Admin clicks "Connect Google Sheets" button
2. A popup opens Google's OAuth consent screen requesting Sheets + Drive scopes
3. Google redirects back with an authorization code
4. An edge function exchanges the code for access/refresh tokens and stores them on the registration config
5. A second edge function uses the admin's refresh token to create sheets or append rows -- sheets live in the admin's own Google Drive

```text
Admin clicks "Connect"
       │
       ▼
  Google OAuth consent  ──► redirect to /google-sheets-callback
       │
       ▼
  Edge fn: exchange code → save refresh_token on config
       │
       ▼
  "Create Sheet" uses admin's token → sheet in admin's Drive
```

## Plan

### Step 1 -- Database: add OAuth columns to registration configs
Add columns to `tournament_registration_configs`:
- `google_refresh_token` (text, nullable) -- encrypted refresh token
- `google_token_expires_at` (timestamptz, nullable)

Keep existing `google_sheet_id` and `google_sheet_url` columns.

### Step 2 -- Create Google OAuth credentials
You will need to create a Google Cloud OAuth **Web Application** client (not a service account):
- Authorized redirect URI: `https://fagsallday.com/#/google-sheets-callback`
- Scopes: `https://www.googleapis.com/auth/spreadsheets`, `https://www.googleapis.com/auth/drive.file`
- Store `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET` as project secrets

### Step 3 -- Edge function: `google-sheets-exchange`
New edge function that:
- Receives the authorization code + config_id
- Exchanges code for access + refresh tokens via Google's token endpoint
- Stores the refresh token on the registration config row (service-role update)
- Returns success

### Step 4 -- Update `create-registration-sheet` edge function
Replace service-account logic with:
- Read `google_refresh_token` from the config row
- Use refresh token to get a fresh access token
- Create sheet using the admin's credentials
- Sheet lives in admin's Google Drive (no permission issues)

### Step 5 -- Update `sync-registration-to-sheets` edge function
Same pattern: use the config's refresh token instead of the service account key.

### Step 6 -- Frontend: OAuth flow + callback
- Replace the "Create Google Sheet" button with "Connect Google Sheets"
- On click, open Google OAuth URL in a popup with `config_id` in state
- Add a `/google-sheets-callback` route that captures the code and calls the exchange edge function
- After successful connection, show the "Create Sheet" button (which now uses the admin's token)

### Step 7 -- Cleanup
- Remove `GOOGLE_SERVICE_ACCOUNT_KEY` dependency from both edge functions
- Keep the secret for backward compatibility but stop relying on it

## Files changed
- **Migration**: add `google_refresh_token`, `google_token_expires_at` to `tournament_registration_configs`
- **New**: `supabase/functions/google-sheets-exchange/index.ts`
- **Edit**: `supabase/functions/create-registration-sheet/index.ts`
- **Edit**: `supabase/functions/sync-registration-to-sheets/index.ts`
- **Edit**: `src/pages/TournamentRegistrationAdmin.tsx` (OAuth button + flow)
- **New**: Google Sheets callback handler component/route in `src/App.tsx`

## Secrets needed
- `GOOGLE_OAUTH_CLIENT_ID` -- from Google Cloud Console OAuth credentials
- `GOOGLE_OAUTH_CLIENT_SECRET` -- from Google Cloud Console OAuth credentials

## What you need to do
1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create an **OAuth 2.0 Client ID** (Web application type)
3. Set authorized redirect URI to `https://fagsallday.com/#/google-sheets-callback`
4. Enable the **Google Sheets API** and **Google Drive API** for the project
5. Copy the Client ID and Client Secret -- I'll prompt you to save them as secrets

