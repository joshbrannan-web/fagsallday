

## Add 4-Hour Inactivity Timeout

### Overview

Add an inactivity-based auto-logout that signs the user out after 4 hours of no interaction, in addition to the existing 24-hour wall-clock limit. Activity is tracked via user interaction events (clicks, taps, key presses, scrolls). The timeout is deferred if a round is currently active, matching the existing behavior.

### Changes

**Modified file: `src/hooks/useAuth.tsx`**

1. **Add an `INACTIVITY_MAX_AGE` constant** set to `4 * 60 * 60 * 1000` (4 hours).

2. **Track last activity timestamp** in `localStorage` (key: `fg_last_activity`):
   - Set it on sign-in (alongside `fg_session_start`)
   - Update it on user interaction events

3. **Register interaction listeners** inside the existing `useEffect`:
   - Listen for `pointerdown`, `keydown`, and `scroll` events on `window`
   - Throttle updates to once per 60 seconds to avoid excessive writes
   - Update `fg_last_activity` in localStorage on each throttled event

4. **Extend the existing `setInterval` check** (already runs every 60s):
   - After the current 24-hour wall-clock check, add a second check:
     - Read `fg_last_activity` from localStorage
     - If `Date.now() - lastActivity > INACTIVITY_MAX_AGE`, and no active cached round, sign out with a toast: "Signed out due to inactivity."

5. **Clean up** `fg_last_activity` from localStorage on sign-out and stale session detection, alongside the existing `fg_session_start` cleanup.

6. **Remove listeners** in the useEffect cleanup function.

### Technical Notes

- Throttling interaction events to 60-second intervals keeps localStorage writes minimal while maintaining reasonable precision for a 4-hour window.
- Using `pointerdown` covers both mouse clicks and touch events in a single listener.
- The active-round safeguard applies to both the 24-hour and inactivity timeouts consistently.
- The toast message distinguishes inactivity logout ("Signed out due to inactivity") from session expiry ("Session expired") so users understand why they were logged out.

