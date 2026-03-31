

# Fix Registration Share Link to Use Production URL

## Problem
When you copy the registration share link from the admin panel, it uses `window.location.origin` which resolves to the Lovable preview URL (e.g., `id-preview--*.lovable.app`). That URL requires a Lovable login, so anyone you share it with gets blocked.

## Fix

### `src/pages/TournamentRegistrationAdmin.tsx`

Replace the dynamic `window.location.origin` with the production domain `https://fagsallday.com` for share links:

1. **`copyShareLink` function** — change the URL construction to:
   ```ts
   const url = `https://fagsallday.com/#/register/${shareCode}`;
   ```

2. **Displayed share link** (the `<code>` element) — update to show:
   ```
   https://fagsallday.com/#/register/{selectedConfig.share_code}
   ```

This is a single-file, 2-line change. The link will always point to the published production site, which is publicly accessible without any Lovable login.

