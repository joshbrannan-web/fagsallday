

## Add GHIN Sync Confirmation Dialog

After a successful first-time GHIN link -- whether from the GhinPrompt dialog on the Landing page or from the Edit Profile page -- show a confirmation dialog explaining that the sync is one-way.

### Dialog Content

- **Title:** "Great, Your GHIN is Synced!"
- **Description:** "This is a 1-way sync that will pull your updated Handicap from USGA. It does NOT send data or Round info to USGA."
- **Button:** "Got It" (closes the dialog)

### Changes

**New file: `src/components/GhinSyncConfirmation.tsx`**

A reusable dialog component that accepts `open` and `onClose` props. Displays the confirmation message and a "Got It" button.

**Modified file: `src/components/GhinPrompt.tsx`**

- Add a `showSyncConfirmation` state
- After a successful GHIN link in `handleLinkGhin`, instead of just closing the dialog, set `showSyncConfirmation = true`
- Render the `GhinSyncConfirmation` dialog, closing it sets the state back to false

**Modified file: `src/pages/Profile.tsx`**

- Import `GhinSyncConfirmation`
- Add a `showSyncConfirmation` state
- In `handleSyncGhin`, only show the confirmation when it is a first-time link (i.e., the profile did not previously have a GHIN number -- check `!isGhinLinked` before the sync call). Refreshing an already-linked GHIN should NOT trigger the dialog.
- Render the `GhinSyncConfirmation` dialog at the bottom of the component

### Technical Details

The confirmation dialog is a simple presentational component:

```
GhinSyncConfirmation({ open, onClose })
  -> Dialog with title, description text, and "Got It" button
```

The key distinction in Profile.tsx: the dialog only appears on initial link (when `isGhinLinked` was false before the sync), not on refresh of an already-linked GHIN.
