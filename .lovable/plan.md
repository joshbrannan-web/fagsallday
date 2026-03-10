

# Show Admin & Tournament Admin Badges on Users Tab

## Problem
The admin panel's Users tab lists all users but doesn't indicate which users are App Admins or Tournament Admins.

## Approach
Fetch `user_roles` and `tournament_admins` tables on admin panel load, then display badges next to user names in the Users table.

## Changes

### 1. `src/pages/Admin.tsx`
- In `fetchData`, add two parallel queries:
  - `user_roles` table → get all rows to identify app admins
  - `tournament_admins` table → get all rows to identify tournament admins
- Store results as `Set<string>` (user IDs) in state: `adminUserIds` and `tournamentAdminIds`
- In the Users table, next to each user's display name, render:
  - A purple "Admin" badge if user ID is in `adminUserIds`
  - A gold/amber "Tournament Admin" badge if user ID is in `tournamentAdminIds`

### UI Result
```
Display Name          Email              ...
Josh [Admin] [T-Admin]  josh@example.com  ...
Mike [T-Admin]          mike@example.com  ...
Sarah                   sarah@example.com ...
```

**1 file changed, 0 database changes.** No new RLS policies needed — admin already has SELECT on `user_roles` and `tournament_admins`.

