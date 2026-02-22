

## Add "What's New" Popup on Login (Updated Dialog Order)

### Overview

Show a "What's New" dialog the first time a user logs in after updates have been deployed. The dialog now appears **before** the GHIN prompt, so users learn about GHIN sync as a new feature before being asked to enter their number.

### Dialog Sequencing (Updated Order)

1. **Onboarding Overlay** -- first-time users only, sets `fg_onboarding_complete` on dismiss
2. **What's New** -- shows after onboarding is complete, before GHIN prompt
3. **GHIN Prompt** -- shows after What's New is dismissed

This means:
- New users see: Onboarding -> What's New -> GHIN Prompt (in sequence)
- Existing users who haven't seen this version's What's New: What's New -> then GHIN (if not already linked/dismissed)
- No two dialogs ever overlap

### What's New Content

1. **GHIN Handicap Sync** -- Link your GHIN number to automatically pull your handicap from USGA. One-way sync keeps your index current.
2. **Live Round Viewing** -- If you're a linked player in someone else's round, you can now view the live scorecard in real-time from the home screen.
3. **Round Sharing** -- Finished rounds are automatically shared with linked players so everyone can see results in their history.

### Changes

**New file: `src/components/WhatsNewDialog.tsx`**

- Dialog with scrollable list of updates, each with icon, title, and description
- Single "Got It" button to dismiss
- Open condition checks:
  - User is logged in
  - `fg_onboarding_complete` is `'true'` in localStorage
  - `fg_whats_new_seen` does not match `WHATS_NEW_VERSION`
- No longer checks for GHIN status (since it now shows before GHIN prompt)
- On dismiss: `localStorage.setItem('fg_whats_new_seen', WHATS_NEW_VERSION)`

**Modified file: `src/components/GhinPrompt.tsx`**

- Add one additional condition to the existing `useEffect` that controls when the GHIN dialog opens
- Only show GHIN prompt when `localStorage('fg_whats_new_seen')` matches the current `WHATS_NEW_VERSION` (meaning What's New has been dismissed)
- Import the `WHATS_NEW_VERSION` constant from `WhatsNewDialog.tsx`
- All other GHIN prompt logic stays the same

**Modified file: `src/components/Landing.tsx`**

- Import and render `WhatsNewDialog` alongside existing `OnboardingOverlay` and `GhinPrompt` (only when `user` is truthy)
- No extra state or props needed -- each dialog self-manages via localStorage

### Technical Details

**WhatsNewDialog open logic:**
```
const WHATS_NEW_VERSION = "2026-02-22";  // exported

useEffect:
  if user is logged in
    AND localStorage('fg_onboarding_complete') === 'true'
    AND localStorage('fg_whats_new_seen') !== WHATS_NEW_VERSION
  then open dialog
```

**GhinPrompt updated open logic (existing + one new check):**
```
useEffect:
  if profile loaded
    AND no ghin_number on profile
    AND fg_ghin_prompt_dismissed not set
    AND localStorage('fg_whats_new_seen') === WHATS_NEW_VERSION   // NEW
  then open dialog
```

To add future updates, bump `WHATS_NEW_VERSION` and update the `updates` array. The What's New dialog reappears for all users, and GHIN prompt remains gated behind it.

