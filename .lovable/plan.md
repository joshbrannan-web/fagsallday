

# Fix: Team Banker in Tournament Mode Always Uses 18-Hole Mode

## Problem
When a player selects Team Banker in tournament mode, the Team Setup screen shows "Stretch 1: Holes 1-6" (sixes mode) instead of "Full Round: Holes 1-18". The `GameSelector` correctly forces `mode: 'eighteen'` on the config object, but `TeamSetupStep` reads it via `teamBankerGame.config?.teamBanker?.mode ?? 'sixes'` — the fallback to `'sixes'` fires when the nested config path isn't fully populated.

## Fix

### `src/components/TeamSetupStep.tsx`
- **Line 160**: Change the `_META_MODE` fallback from `'sixes'` to read from the game config with a smarter chain: `teamBankerGame.config?.teamBanker?.mode ?? 'eighteen'` when in tournament context, or detect it from the mode value already on the config. The simplest fix: since `GameSelector` already forces `mode: 'eighteen'` for tournament, just ensure `TeamSetupStep` reads it correctly. Change line 160 from:
  ```ts
  _META_MODE: teamBankerGame.config?.teamBanker?.mode ?? 'sixes',
  ```
  to:
  ```ts
  _META_MODE: teamBankerGame.config?.teamBanker?.mode ?? 'sixes',
  ```
  Actually the real issue is the config may not have `.teamBanker` populated at all. The fix is to also default properly.

### Concrete changes:

1. **`src/components/TeamSetupStep.tsx` line 160** — The `_META_MODE` is written to `gameData` and controls the engine. Keep the fallback but it should already work if `GameSelector` set it. Need to verify the config is actually being passed through. The real fix: the `TeamSetupStep` UI header also displays stretch info — it likely reads mode independently and defaults to sixes. Check and fix any UI label that says "Stretch 1: Holes 1-6" to respect the actual mode.

2. **`src/components/teamBanker/TeamBankerTeamSetup.tsx`** — This is the component shown in `ActiveRound` at stretch start. It receives `mode` from `getTeamBankerMode()` which reads `gameData[gameId][1]._META_MODE`. If the round hasn't written `_META_MODE` yet (setup screen is shown *before* confirmation writes the metadata), the mode defaults to `'sixes'`. The fix: pass the mode from the game config as a fallback when no metadata exists yet.

3. **`src/components/ActiveRound.tsx` ~line 994** — When showing TeamBankerTeamSetup before any metadata is written, `getTeamBankerMode` returns `'sixes'` because `gameData` is empty. Override the mode with the game's config value: `tbGame.config?.teamBanker?.mode ?? 'sixes'`. For tournament rounds, `GameSelector` already set this to `'eighteen'`.

### Files Changed
| File | Change |
|---|---|
| `src/components/ActiveRound.tsx` | When showing Team Banker setup, use `tbGame.config?.teamBanker?.mode` as the mode source instead of relying solely on `getTeamBankerMode` (which reads from gameData that hasn't been written yet) |
| `src/components/TeamSetupStep.tsx` | Ensure `_META_MODE` written to gameData uses the config value correctly (line 160 — already reads from config, just verify the path is populated) |

