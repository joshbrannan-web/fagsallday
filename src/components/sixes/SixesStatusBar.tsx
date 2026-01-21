import React from 'react';
import { Round, GameSettings } from '@/types';
import { getSixesStretchForHole, getSixesTeamAssignment, calculateSixesStretchResult } from '@/services/sixesEngine';

interface SixesStatusBarProps {
  round: Round;
  game: GameSettings;
  activeHole: number;
}

const SixesStatusBar: React.FC<SixesStatusBarProps> = ({ round, game, activeHole }) => {
  const stretch = getSixesStretchForHole(activeHole);
  const teamAssignment = getSixesTeamAssignment(round.gameData, game.id, stretch);
  
  if (!teamAssignment) return null;
  
  const { teamA, teamB, unitValue, useSecondBallTiebreaker } = teamAssignment;
  const stretchResult = calculateSixesStretchResult(round, game, stretch);
  
  const getPlayerName = (playerId: string): string => {
    return round.players.find(p => p.id === playerId)?.name || 'Unknown';
  };
  
  const teamANames = teamA.map(getPlayerName);
  const teamBNames = teamB.map(getPlayerName);
  
  const stretchHoles = {
    1: '1-6',
    2: '7-12',
    3: '13-18'
  };

  return (
    <div className="bg-card rounded-xl border border-border p-3 mb-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">🎲</span>
          <span className="text-sm font-bold text-foreground">6's: Holes {stretchHoles[stretch]}</span>
        </div>
        <span className="text-xs text-muted-foreground">${unitValue}/player</span>
      </div>
      
      {/* Team Names */}
      <div className="grid grid-cols-2 gap-2 mb-2 text-xs">
        <div className="bg-primary/10 rounded-lg p-2 text-center">
          <div className="text-primary font-bold">Team A</div>
          <div className="text-muted-foreground truncate">{teamANames.join(' & ')}</div>
        </div>
        <div className="bg-destructive/10 rounded-lg p-2 text-center">
          <div className="text-destructive font-bold">Team B</div>
          <div className="text-muted-foreground truncate">{teamBNames.join(' & ')}</div>
        </div>
      </div>
      
      {/* Holes Won */}
      {stretchResult && (
        <div className="flex items-center justify-center gap-4 py-2 bg-muted rounded-lg">
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">{stretchResult.teamAWins}</div>
            <div className="text-xs text-muted-foreground">Team A</div>
          </div>
          <div className="text-lg text-muted-foreground">-</div>
          <div className="text-center">
            <div className="text-2xl font-bold text-destructive">{stretchResult.teamBWins}</div>
            <div className="text-xs text-muted-foreground">Team B</div>
          </div>
          {stretchResult.ties > 0 && (
            <>
              <div className="text-lg text-muted-foreground">|</div>
              <div className="text-center">
                <div className="text-xl font-bold text-muted-foreground">{stretchResult.ties}</div>
                <div className="text-xs text-muted-foreground">Ties</div>
              </div>
            </>
          )}
        </div>
      )}
      
      {/* 2nd Ball indicator */}
      {useSecondBallTiebreaker && (
        <div className="mt-2 text-center">
          <span className="text-xs bg-accent/20 text-accent-foreground px-2 py-0.5 rounded-full">
            2nd Ball Tiebreaker Active
          </span>
        </div>
      )}
    </div>
  );
};

export default SixesStatusBar;
