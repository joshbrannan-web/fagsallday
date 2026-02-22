

## Feature: Admin Broadcast Email to All Users

### Overview
Add the ability for the admin to compose and send a broadcast email to all registered users directly from the Admin panel. This will use the existing Resend integration and admin authentication pattern.

### Changes

#### 1. New Edge Function: `admin-send-broadcast`
Create `supabase/functions/admin-send-broadcast/index.ts` that:
- Verifies the caller is an authenticated admin (same pattern as `admin-list-users`)
- Accepts a `subject` and `htmlBody` (or `message`) in the request body
- Uses the service role key to list all auth users' emails
- Sends the email to all users via the existing Resend API key
- Uses BCC or batch sending to avoid exposing user emails to each other
- Includes rate limiting (e.g., 5 broadcasts per hour per admin)
- Includes CORS headers matching the existing pattern (fagsallday.com, lovable.app, lovableproject.com)

#### 2. Update Admin Page: `src/pages/Admin.tsx`
- Add a third tab "Email" (with a Mail icon) to the existing Tabs component
- The tab contains:
  - A subject text input
  - A message textarea for the email body
  - A preview section showing how the email will look (using the same branded template as the welcome email)
  - A "Send to All Users" button with a confirmation dialog warning how many users will receive it
- On send, calls `supabase.functions.invoke('admin-send-broadcast', { body: { subject, message } })`
- Shows success/error toast notifications

### Technical Details

**Edge Function (`supabase/functions/admin-send-broadcast/index.ts`):**
- Auth check: verify JWT, then call `has_role(_user_id, 'admin')` RPC -- same as other admin functions
- Fetch all user emails: use `adminClient.auth.admin.listUsers()` with service role key
- Send via Resend using the branded HTML template (matching F&Gs All Day styling from the welcome email)
- Rate limit: 5 per hour per admin to prevent accidental spam
- The email "from" address: `F&Gs All Day <noreply@fagsallday.com>` (same as welcome email)

**Admin Page UI additions:**
- New tab trigger with Mail icon alongside existing Users and Rounds tabs
- `TabsList` changes from `grid-cols-2` to `grid-cols-3`
- Subject input field (required)
- Message textarea (required, supports multi-line plain text that gets wrapped in the branded HTML template)
- User count display ("This will be sent to X users")
- Confirmation AlertDialog before sending
- Loading state on the send button

**Config (`supabase/config.toml`):**
- Add `[functions.admin-send-broadcast]` with `verify_jwt = false` (validation done in code, matching other admin functions)

