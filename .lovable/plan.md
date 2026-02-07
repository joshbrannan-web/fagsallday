

## Plan: Add Edit Profile Page

### Overview
Create a new `/profile` page where users can update their display name and handicap index. Add an "Edit Profile" link in the user dropdown menu on the Landing page.

---

### New File: `src/pages/Profile.tsx`

Create a profile editing page that follows the same layout pattern as the existing `Players.tsx` page:

- **Header**: Back arrow + "Edit Profile" title (sticky top bar, same as Players page)
- **Form Fields**:
  - Display Name (text input, required)
  - Handicap Index (number input, step 0.1)
- **Save Button**: Calls `updateProfile` from `useAuth` hook
- **Loading/Auth Guards**: Show spinner while loading, redirect to auth if not signed in (same pattern as Players page)
- **Success Feedback**: Toast notification on save, then navigate back to home

```text
+------------------------------------------+
| <- Back          Edit Profile            |
+------------------------------------------+
|                                          |
|  Display Name                            |
|  [  Josh Smith                        ]  |
|                                          |
|  Handicap Index                          |
|  [  12.4                              ]  |
|                                          |
|  [ Save Changes ]                        |
|                                          |
+------------------------------------------+
```

---

### Modified File: `src/App.tsx`

- Import the new `Profile` page component
- Add route: `<Route path="/profile" element={<Profile />} />`

---

### Modified File: `src/components/Landing.tsx`

- Add `Edit2` to the lucide-react imports
- Add an "Edit Profile" dropdown menu item between the profile info section and "My Players":

```text
  Josh Smith
  Handicap: 12.4
  ─────────────────
  Edit Profile       <-- NEW
  My Players
  Admin Panel
  ─────────────────
  Sign Out
```

---

### Technical Details

**Profile.tsx implementation approach:**
- Uses `useAuth()` to get current `profile` and `updateProfile` function
- Pre-populates form fields from `profile.display_name` and `profile.handicap_index`
- On submit, calls `updateProfile({ display_name, handicap_index })` which already handles the database update and local state refresh
- Validates display name is not empty
- Clamps handicap between -10 and 54 (matching existing database constraints)

**Files changed:**
| File | Change |
|------|--------|
| `src/pages/Profile.tsx` | New file - profile editing page |
| `src/App.tsx` | Add `/profile` route |
| `src/components/Landing.tsx` | Add "Edit Profile" menu item with Edit2 icon |

