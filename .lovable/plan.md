

# Tournament Admin Request Flow

## Current State
There is no way for a regular user to request tournament admin access. Only app-level admins can insert rows into `tournament_admins` (via RLS). Users either already have access or they don't — there's no discovery or request mechanism.

## Proposed Changes

### 1. New database table: `tournament_admin_requests`
- `id`, `user_id`, `status` (pending/approved/denied), `requested_at`, `reviewed_by`, `reviewed_at`
- RLS: users can insert their own request and read their own; app admins can read/update all

### 2. Landing page — "Request Tournament Admin" button
- Show a button in the user dropdown menu (where "Tournament Admin" appears for existing admins)
- Only visible to authenticated users who are NOT already tournament admins
- Clicking it inserts a row into `tournament_admin_requests` with status `pending`
- If a pending request already exists, show "Request Pending" (disabled)

### 3. Admin Panel — Review requests
- Add a section to the existing `/admin` page showing pending tournament admin requests
- Each request shows the user's display name and a timestamp
- Admin can approve (inserts into `tournament_admins`, updates request to `approved`) or deny (updates to `denied`)

### 4. Files changed
- **New migration**: Create `tournament_admin_requests` table with RLS
- **`src/pages/Players.tsx`** or **`src/components/Landing.tsx`**: Add request button in dropdown
- **`src/pages/Admin.tsx`**: Add pending requests section
- **`src/hooks/useTournamentAdmin.ts`**: Expose `requestStatus` alongside `isTournamentAdmin`

