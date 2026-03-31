

# Save Google Service Account Key

## Problem
The `GOOGLE_SERVICE_ACCOUNT_KEY` secret has been failing to parse. The user has provided a fresh, valid service account key.

## Plan

### Step 1: Update the secret
Use the `add_secret` tool to save the exact JSON the user provided as `GOOGLE_SERVICE_ACCOUNT_KEY`. This replaces whatever mangled value was stored before.

### Step 2: Verify the edge function parsing
Review the current `create-registration-sheet/index.ts` to confirm its parser can handle a clean JSON object (which this now will be). No code changes should be needed since the parser already handles raw JSON.

### Step 3: Test
Trigger the "Create Google Sheet" action from the registration admin page to confirm it works end-to-end.

