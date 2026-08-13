# Why Dallin's handicap reverts to 6.4

## What's actually happening

Your edit *did* save. The database shows Dallin's saved-player row now holds 7.6.

The problem is on the read side. Dallin is a **linked player** — his saved-player entry points at his real fagsallday account. The function that loads your Players list returns the linked account's handicap whenever one exists, and only falls back to the number you typed when the account has none. Dallin's account profile says 6.4, so the list always redisplays 6.4 and your 7.6 looks like it was discarded.

No GHIN sync is involved here — Dallin has no GHIN number on file. It's purely the linked-profile value winning over your local edit.

There's also a data-hygiene issue: there are **six** saved-player rows named "Dallin Demke" under your account (five linked to his profile, one unlinked). Only one of them received the 7.6.

## Proposed fix

Make the edit behave the way you'd expect: editing a linked player's handicap updates the value that is actually displayed.

1. When you save a handicap for a player who is linked to a real account, write the new value to that account's profile as well as the saved-player row. This is the same pathway GHIN sync already uses, so the number sticks and stays consistent everywhere the player appears (rounds, tournaments, other users who have him saved).
2. Show a small "Linked account" note in the edit dialog so it's clear the change affects the linked player's shared handicap, not just your private copy.
3. Clean up the duplicate "Dallin Demke" rows so the list shows him once.

If you'd rather your local edit stay private to your list instead of updating his account, the alternative is to treat a manually entered handicap as an override that wins over the linked profile. That keeps his account untouched but means your list can drift from his real index.

## Technical notes

- Display source: `get_saved_players_with_profiles` uses `COALESCE(profiles.handicap_index, saved_players.handicap_index)` — the profile always wins for linked players.
- Save path: `useSavedPlayers.updatePlayer` writes only to `saved_players`.
- Fix 1 adds a profile write for linked players (via a security-definer function so it's permitted and auditable), keeping the saved-player row in sync.
- The override alternative would instead flip the COALESCE order or add an explicit `handicap_override` column on `saved_players`.
- Duplicate cleanup is a one-off data operation on the redundant `saved_players` rows.
