import React from 'react';
import { Round, GameSettings, SixesPressState } from '@/types';
import { 
  getSixesStretchForHole, 
  getSixesTeamAssignment, 
  calculateSixesStretchResult, 
  getSixesDormieStatus, 
  getSixesPresses, 
  hasExistingSixesPress,
  getSixesMode,
  getStretchName,
  SixesMode 
} from '@/services/sixesEngine';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

interface SixesStatusBarProps {
  round: Round;
  game: GameSettings;
  activeHole: number;
  onTriggerPress?: (teamDormie: 'A' | 'B') => void;
}

const SixesStatusBar: React.FC<SixesStatusBarProps> = ({ round, game, activeHole, onTriggerPress }) => {
  const mode = getSixesMode(round.gameData, game.id);
  const stretch = getSixesStretchForHole(activeHole, mode);
  const teamAssignment = getSixesTeamAssignment(round.gameData, game.id, stretch, mode);
  
  if (!teamAssignment) return null;
  
  const { teamA, teamB, unitValue, useSecondBallTiebreaker, allowPresses } = teamAssignment;
  const stretchResult = calculateSixesStretchResult(round, game, stretch, mode);
  const dormieStatus = getSixesDormieStatus(round, game, activeHole, mode);
  const presses = getSixesPresses(round.gameData, game.id, stretch, mode);
  
  const getPlayerName = (playerId: string): string => {
    return round.players.find(p => p.id === playerId)?.name || 'Unknown';
  };
  
  const teamANames = teamA.map(getPlayerName);
  const teamBNames = teamB.map(getPlayerName);
  
  const stretchHoles = getStretchName(stretch, mode);
  const gameModeLabel = mode === 'threes' ? "3's" : "6's";

  // Determine which team can press (is dormie and doesn't have an active press already)
  const canTeamAPress = allowPresses && dormieStatus?.teamADormie && 
    !hasExistingSixesPress(round.gameData, game.id, stretch, 'A', activeHole, mode);
  const canTeamBPress = allowPresses && dormieStatus?.teamBDormie && 
    !hasExistingSixesPress(round.gameData, game.id, stretch, 'B', activeHole, mode);

  return (
    <div className="bg-card rounded-xl border border-border p-3 mb-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">🎲</span>
          <span className="text-sm font-bold text-foreground">{gameModeLabel}: {stretchHoles}</span>
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

      {/* Press Available Section */}
      {(canTeamAPress || canTeamBPress) && onTriggerPress && (
        <div className="mt-2 p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="text-sm">
              <span className="font-bold text-amber-600">
                Team {canTeamAPress ? 'A' : 'B'} can Press
              </span>
              <span className="text-muted-foreground ml-1">
                ({dormieStatus?.holesRemaining} hole{dormieStatus?.holesRemaining !== 1 ? 's' : ''} left)
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="border-amber-500 text-amber-600 hover:bg-amber-500/10"
              onClick={() => onTriggerPress(canTeamAPress ? 'A' : 'B')}
            >
              Press ${unitValue}
            </Button>
          </div>
        </div>
      )}

      {/* Active Presses indicator */}
      {presses.length > 0 && (
        <div className="mt-2 p-2 bg-amber-500/5 border border-amber-500/20 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-3 h-3 text-amber-500" />
            <span className="text-xs font-bold text-amber-600">Active Presses</span>
          </div>
          <div className="space-y-1">
            {presses.map((press, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  Team {press.teamDormie} pressed on Hole {press.startHole}
                </span>
                <span className="font-medium text-amber-600">${press.unitValue}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SixesStatusBar;
