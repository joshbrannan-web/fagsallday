

## GHIN Prompt for Existing Users

Add a one-time popup dialog on the Landing page that prompts existing signed-in users to enter their USGA GHIN number if they haven't linked one yet, with an educational follow-up when dismissed.

### Behavior

- When a signed-in user lands on the home screen and their profile has no `ghin_number`, a dialog appears asking them to link their GHIN
- The dialog has an input field for the GHIN number and a "Link GHIN" button that syncs via the existing `sync-ghin-handicap` edge function
- A "Dismiss, No GHIN" button:
  1. Closes the GHIN prompt dialog
  2. Opens a second informational popup telling the user they can add their GHIN later via Edit Profile
  3. When the user closes that info popup, `fg_ghin_prompt_dismissed` is set in localStorage so the GHIN prompt never appears again
- The GHIN prompt does NOT appear if:
  - The user already has a `ghin_number` in their profile
  - The user previously dismissed the prompt (localStorage flag set)
  - The user is not signed in or auth is still loading

### Dialog Flow

```text
+-----------------------------+
|   Link Your USGA GHIN      |
|                             |
|   [GHIN Number Input]      |
|                             |
|   [Link GHIN]              |
|   [Dismiss, No GHIN]       |
+-----------------------------+
          |
     (if dismiss)
          v
+-----------------------------+
|   No Problem!               |
|                             |
|   You can always add your   |
|   GHIN later by going to   |
|   Edit Profile from the    |
|   menu.                    |
|                             |
|   [Got It]                  |
+-----------------------------+
          |
     (sets localStorage,
      never shows again)
```

### Technical Details

**New file: `src/components/GhinPrompt.tsx`**

A self-contained component managing two dialogs via internal state:
- State: `showGhinDialog`, `showInfoDialog`, `ghinNumber`, `isLoading`
- On mount: checks `profile?.ghin_number` and `localStorage.getItem('fg_ghin_prompt_dismissed')` to decide whether to show
- **GHIN Dialog**: Input for GHIN number, "Link GHIN" button (calls `sync-ghin-handicap` then `updateProfile`), "Dismiss, No GHIN" button (closes GHIN dialog, opens info dialog)
- **Info Dialog**: Simple message -- "You can always add your GHIN later by selecting Edit Profile from the menu." with a "Got It" button that sets `localStorage.setItem('fg_ghin_prompt_dismissed', 'true')` and closes
- Uses existing Dialog, Button, Input, and Label components from the UI library

**Modified file: `src/components/Landing.tsx`**

- Import and render `<GhinPrompt />` alongside `<OnboardingOverlay />`, only when `user` is truthy

