import React from 'react';
import { Round, GameSettings } from '@/types';
import { getSixesStretchForHole, getSixesTeamAssignment, calculateSixesStretchResult, calculateSixesStretchPayouts } from '@/services/sixesEngine';
import { Trophy, TrendingDown, Minus } from 'lucide-react';

interface SixesStretchSummaryProps {
  round: Round;
  game: GameSettings;
  stretch: 1 | 2 | 3;
}

const SixesStretchSummary: React.FC<SixesStretchSummaryProps> = ({ round, game, stretch }) => {
  const teamAssignment = getSixesTeamAssignment(round.gameData, game.id, stretch);
  const stretchResult = calculateSixesStretchResult(round, game, stretch);
  const stretchPayouts = calculateSixesStretchPayouts(round, game, stretch);
  
  if (!teamAssignment || !stretchResult) return null;
  
  const { teamA, teamB, unitValue } = teamAssignment;
  const { teamAWins, teamBWins, ties, complete } = stretchResult;
  
  const getPlayerName = (playerId: string): string => {
    return round.players.find(p => p.id === playerId)?.name || 'Unknown';
  };
  
  const stretchNames = {
    1: 'Holes 1-6',
    2: 'Holes 7-12',
    3: 'Holes 13-18'
  };
  
  // Determine winner
  let winnerTeam: 'A' | 'B' | 'PUSH' = 'PUSH';
  if (teamAWins > teamBWins) winnerTeam = 'A';
  else if (teamBWins > teamAWins) winnerTeam = 'B';
  
  const winAmount = unitValue * 2; // Each winner gets $unitValue from each opponent

  return (
    <div className="bg-card rounded-xl border border-border p-4 space-y-4">
      <div className="text-center">
        <h3 className="text-lg font-bold text-foreground">6's Summary: {stretchNames[stretch]}</h3>
        {!complete && (
          <p className="text-sm text-muted-foreground">Stretch in progress...</p>
        )}
      </div>
      
      {/* Score Display */}
      <div className="flex items-center justify-center gap-6 py-4 bg-muted rounded-xl">
        <div className="text-center">
          <div className={`text-4xl font-bold ${winnerTeam === 'A' ? 'text-green-500' : 'text-muted-foreground'}`}>
            {teamAWins}
          </div>
          <div className="text-sm text-primary font-medium">Team A</div>
          <div className="text-xs text-muted-foreground">
            {teamA.map(getPlayerName).join(' & ')}
          </div>
        </div>
        
        <div className="text-3xl text-muted-foreground">-</div>
        
        <div className="text-center">
          <div className={`text-4xl font-bold ${winnerTeam === 'B' ? 'text-green-500' : 'text-muted-foreground'}`}>
            {teamBWins}
          </div>
          <div className="text-sm text-destructive font-medium">Team B</div>
          <div className="text-xs text-muted-foreground">
            {teamB.map(getPlayerName).join(' & ')}
          </div>
        </div>
      </div>
      
      {ties > 0 && (
        <div className="text-center text-sm text-muted-foreground">
          {ties} hole{ties > 1 ? 's' : ''} tied
        </div>
      )}
      
      {/* Results */}
      {complete && (
        <div className="space-y-2">
          {winnerTeam === 'PUSH' ? (
            <div className="flex items-center justify-center gap-2 p-3 bg-muted rounded-lg">
              <Minus className="w-5 h-5 text-muted-foreground" />
              <span className="text-lg font-bold text-muted-foreground">PUSH</span>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Winners */}
              {(winnerTeam === 'A' ? teamA : teamB).map(playerId => (
                <div key={playerId} className="flex items-center justify-between p-3 bg-primary/10 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-primary" />
                    <span className="font-medium text-foreground">{getPlayerName(playerId)}</span>
                  </div>
                  <span className="text-lg font-bold text-primary">+${winAmount}</span>
                </div>
              ))}
              
              {/* Losers */}
              {(winnerTeam === 'A' ? teamB : teamA).map(playerId => (
                <div key={playerId} className="flex items-center justify-between p-3 bg-destructive/10 rounded-lg">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="w-5 h-5 text-destructive" />
                    <span className="font-medium text-foreground">{getPlayerName(playerId)}</span>
                  </div>
                  <span className="text-lg font-bold text-destructive">-${winAmount}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SixesStretchSummary;
