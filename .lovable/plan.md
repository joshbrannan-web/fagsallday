

## Integrate GHIN Link into Signup Form

### Overview

Replace the standalone handicap field on the signup form with a toggle between "Link GHIN" (default) and "Enter Manually." Users who choose manual entry and dismiss will see an info dialog telling them they can add GHIN later via Edit Profile — and `fg_ghin_prompt_dismissed` is set so the post-login GHIN popup is suppressed. Existing users without a linked GHIN still see the popup as before.

### Changes

**Modified file: `src/pages/Auth.tsx`**

1. **Add state variables**: `handicapMethod` (`'ghin' | 'manual'`, default `'ghin'`), `ghinNumber` (string), `ghinSyncing` (boolean).

2. **Replace the handicap input section** in signup mode with a toggle UI:
   - Two small text buttons: "I have a GHIN" / "Enter manually"
   - When "I have a GHIN" is selected: show a GHIN number input (5-9 digits)
   - When "Enter manually" is selected: show the existing handicap index number input

3. **Update `handleSubmit`** for signup:
   - If `handicapMethod === 'ghin'` and `ghinNumber` is provided:
     - Call `sync-ghin-handicap` edge function to validate and fetch handicap
     - On failure: show error toast, stop submission
     - On success: use returned `handicap_index` for signup, then update profile with `ghin_number`, `handicap_index`, `ghin_last_synced`
   - If `handicapMethod === 'manual'`: use manually entered value (current behavior)

4. **After successful signup**:
   - If GHIN was linked: set `localStorage.setItem('fg_ghin_prompt_dismissed', 'true')` — suppresses the GHIN Prompt popup
   - If manual entry: set `localStorage.setItem('fg_ghin_prompt_dismissed', 'true')` — also suppresses the popup, **and** show the info dialog telling the user they can link GHIN later via **Edit Profile**

5. **Info dialog** (inline in Auth.tsx or reuse a simple Dialog):
   - Title: "No Problem!"
   - Body: "You can always link your GHIN later by selecting **Edit Profile** from the menu."
   - Single "Got It" button to dismiss

**No changes to `src/components/GhinPrompt.tsx`** — existing users who haven't linked or dismissed still see the popup. New users who went through signup will have `fg_ghin_prompt_dismissed` set, so the popup is skipped.

