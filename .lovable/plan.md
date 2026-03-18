

# Create `delete-tournament-rounds` Edge Function

## Overview
Create a single new file at `supabase/functions/delete-tournament-rounds/index.ts` with the exact content provided. No other files are modified.

## What it does
- Authenticates the caller via JWT
- Accepts a `tournamentId` in the request body
- Uses the service role client to find all `rounds` rows where `game_data->_TOURNAMENT_META->>tournamentId` matches
- Deletes those rounds and returns the count and IDs

## File created
`supabase/functions/delete-tournament-rounds/index.ts` — exact content as specified in the request.

