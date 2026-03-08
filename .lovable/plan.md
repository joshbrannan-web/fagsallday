

# Fix missing teamNames in useTournamentScorecard

## Problem
The `EngineInput` at line 182 doesn't include `teamNames`, so the engine defaults to "Team A" / "Team B" in result labels.

## Fix — `src/hooks/useTournamentScorecard.ts`

1. Add state: `const [teamNames, setTeamNames] = useState<Record<string, string>>({});`
2. In `loadEngineData` (after fetching `round`), fetch teams:
   ```ts
   const { data: teamsData } = await supabase
     .from('tournament_teams')
     .select('id, name')
     .eq('tournament_id', round.tournament_id);
   const names: Record<string, string> = {};
   (teamsData || []).forEach(t => { names[t.id] = t.name; });
   setTeamNames(names);
   ```
3. Add `teamNames` to the engine input object at line 188:
   ```ts
   const engineInput: EngineInput = {
     game: tournamentGame,
     holePointOverrides,
     players: tournamentPlayers,
     teamAssignments,
     scores: scoresMap,
     courseHoles,
     teamNames,  // ← add this
   };
   ```

1 file changed, 0 database changes.

