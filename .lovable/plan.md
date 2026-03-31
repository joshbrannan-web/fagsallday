

# Tournament Registration System

## Overview

A public registration page that tournament admins can share with potential players. Registrants fill out a form (no login required, but can optionally link their account). All registrations sync live to a Google Sheet and are viewable in the admin portal.

## Database Changes (2 new tables)

### `tournament_registration_configs`
Stores the registration page settings created by admins.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| created_by | uuid | auth.users ref |
| tournament_id | uuid (nullable) | linked tournament (can be assigned later) |
| name | text | Tournament/event name |
| description | text (nullable) | |
| location | text | Course/venue |
| event_dates | text | Display string for dates |
| amount | numeric | Total or deposit amount |
| amount_label | text | "Total" or "Deposit" |
| venmo_link | text | Venmo payment URL |
| google_sheet_id | text (nullable) | Sheet ID for live sync |
| google_sheet_url | text (nullable) | Full URL for admin reference |
| is_open | boolean | Toggle registration open/closed |
| created_at | timestamptz | |
| share_code | text unique | 6-char code for public URL |

RLS: Tournament admins can CRUD their own configs. Public can SELECT (for the registration page).

### `tournament_registration_entries`
Stores each registrant.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| config_id | uuid | FK to configs |
| user_id | uuid (nullable) | If they have an account |
| full_name | text | |
| email | text | |
| phone | text (nullable) | |
| handicap_index | numeric (nullable) | |
| ghin_number | text (nullable) | |
| payment_confirmed | boolean | Self-reported |
| payment_amount | numeric (nullable) | |
| notes | text (nullable) | |
| created_at | timestamptz | |

RLS: Anyone can INSERT (public registration). Config creator can SELECT/UPDATE/DELETE.

## Google Sheets Integration

### Secret Required
`GOOGLE_SERVICE_ACCOUNT_KEY` — A Google service account JSON key with Sheets API access. Admin will need to:
1. Create a Google Cloud project
2. Enable Google Sheets API
3. Create a service account and download the JSON key
4. Share the target Google Sheet with the service account email

### Edge Function: `sync-registration-to-sheets`
- Called after each registration insert
- Appends a row to the configured Google Sheet: Name, Email, Phone, Handicap, GHIN#, Payment Amount, Payment Confirmed, Registered At
- If no sheet is configured yet, skips silently
- Uses Google Sheets API v4 directly (no SDK needed in Deno)

### Edge Function: `create-registration-sheet`
- Called when admin creates a registration config
- Creates a new Google Sheet with headers pre-filled
- Returns the sheet ID and URL to store in the config
- Shares the sheet with the admin's email (optional input)

## Frontend Changes

### New Files

1. **`src/pages/TournamentRegistration.tsx`** — Public registration form page
   - Accessed via `/register/:shareCode`
   - Shows tournament name, dates, location, amount, Venmo link
   - Form: Full Name, Email, Phone, Handicap Index, GHIN Number
   - Payment confirmation checkbox + amount field
   - Optional: "Link to your account" button (if logged in, auto-fills and sets user_id)
   - Submit calls edge function which inserts + syncs to sheet

2. **`src/pages/TournamentRegistrationAdmin.tsx`** — Admin config creator + registrant viewer
   - Accessed via `/tournament-admin/registrations`
   - List of existing registration configs
   - "Create Registration Page" form with all config fields
   - Click into a config to see registrants table with export option
   - Shareable link display with copy button
   - Toggle open/closed
   - Assign to existing tournament dropdown

3. **`src/components/tournament-admin/RegistrationConfigForm.tsx`** — Form for creating/editing config
4. **`src/components/tournament-admin/RegistrationEntryList.tsx`** — Table of registrants

### Modified Files

5. **`src/App.tsx`** — Add routes:
   - `/register/:shareCode` → public registration page
   - `/tournament-admin/registrations` → admin list
   - `/tournament-admin/registrations/:configId` → admin detail view

6. **`src/pages/TournamentAdmin.tsx`** — Add "Registrations" button/link to admin portal

## User Flow

```text
Admin Flow:
  Tournament Admin Portal
    → "Registrations" button
    → Create Registration Page (fills in details)
    → Gets shareable link: yourapp.com/#/register/ABC123
    → Views registrants in-app + Google Sheet updates live
    → Later: assigns registrants to a tournament

Player Flow:
  Opens shared link → /register/ABC123
    → Sees tournament info + Venmo link
    → Fills form (name, email, phone, handicap, GHIN#)
    → Confirms payment amount
    → Submits → sees success message
    → (Optional) If logged in, registration links to their account
```

## Summary

| Change | Type |
|--------|------|
| `tournament_registration_configs` table | Migration |
| `tournament_registration_entries` table | Migration |
| `sync-registration-to-sheets` edge function | New file |
| `create-registration-sheet` edge function | New file |
| `TournamentRegistration.tsx` page | New file |
| `TournamentRegistrationAdmin.tsx` page | New file |
| `RegistrationConfigForm.tsx` component | New file |
| `RegistrationEntryList.tsx` component | New file |
| `App.tsx` | Add routes |
| `TournamentAdmin.tsx` | Add nav link |
| `GOOGLE_SERVICE_ACCOUNT_KEY` secret | Required from user |

2 migrations, 2 edge functions, 4 new components/pages, 2 modified files.

