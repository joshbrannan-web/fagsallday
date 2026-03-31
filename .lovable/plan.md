

# Fix Venmo Link Navigation

## Problem
The "Pay via Venmo" button doesn't navigate to Venmo because the stored URL likely lacks the `https://` protocol prefix (e.g., user enters `venmo.com/u/Username` instead of `https://venmo.com/u/Username`). The browser then treats it as a relative route within the app.

## Fix

### 1. `src/pages/TournamentRegistration.tsx`
Add a helper function that ensures the venmo_link always starts with `https://`:

```ts
const ensureUrl = (url: string) =>
  url.match(/^https?:\/\//) ? url : `https://${url}`;
```

Use `ensureUrl(config.venmo_link)` in both `<a href=...>` tags (lines ~157 and ~198).

### 2. `src/components/tournament-admin/RegistrationConfigForm.tsx`
Add the same normalization when submitting the form, so newly created configs store the full URL:

```ts
venmo_link: venmoLink.trim().match(/^https?:\/\//) 
  ? venmoLink.trim() 
  : `https://${venmoLink.trim()}`
```

This is a 2-file change — no database or backend modifications needed.

