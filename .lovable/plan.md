

## Configure GHIN Secrets

Two secrets need to be added to enable the GHIN handicap sync feature:

1. **GHIN_EMAIL** -- The email address (or GHIN number) you use to log into ghin.com or the GHIN mobile app
2. **GHIN_PASSWORD** -- The password for that same GHIN account

Once these are configured, the edge function will use your account to authenticate with the GHIN API and look up any golfer's handicap by their GHIN number. Your credentials are stored securely as backend secrets and are never exposed to the frontend.

### Steps
1. Add the `GHIN_EMAIL` secret with your GHIN login email/number
2. Add the `GHIN_PASSWORD` secret with your GHIN password
3. Verify the sync works by testing from the Profile page

