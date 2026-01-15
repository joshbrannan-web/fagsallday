import React, { useState, useEffect } from 'react';
import { Player } from '@/types';
import { Button } from '@/components/ui/button';
import { Users, ArrowRight, ArrowLeft, Check } from 'lucide-react';

interface Stockton6TeamSetupProps {
  players: Player[];
  stretch: 1 | 2 | 3;
  existingTeamA?: string[];
  existingTeamB?: string[];
  existingUnitValue?: number;
  existingDotValue?: number;
  previousStretchTeams?: { teamA: string[]; teamB: string[] }[];
  onConfirm: (teamA: string[], teamB: string[], unitValue: number, dotValue: number) => void;
  onCancel: () => void;
}

const Stockton6TeamSetup: React.FC<Stockton6TeamSetupProps> = ({
  players,
  stretch,
  existingTeamA,
  existingTeamB,
  existingUnitValue = 5,
  existingDotValue = 2,
  previousStretchTeams = [],
  onConfirm,
  onCancel
}) => {
  const [teamA, setTeamA] = useState<string[]>(existingTeamA || []);
  const [teamB, setTeamB] = useState<string[]>(existingTeamB || []);
  const [unitValue, setUnitValue] = useState(existingUnitValue);
  const [dotValue, setDotValue] = useState(existingDotValue);

  // Generate rotated teams ensuring no two players are on the same team twice
  const getRotatedTeams = (
    playerIds: string[],
    previousTeams: { teamA: string[]; teamB: string[] }[]
  ): { teamA: string[]; teamB: string[] } => {
    if (playerIds.length !== 4) return { teamA: [], teamB: [] };

    // Get all previous pairings
    const previousPairings: Set<string> = new Set();
    previousTeams.forEach(t => {
      if (t.teamA.length === 2) {
        previousPairings.add([...t.teamA].sort().join(','));
      }
      if (t.teamB.length === 2) {
        previousPairings.add([...t.teamB].sort().join(','));
      }
    });

    // Find a pairing not used before
    for (let i = 0; i < 4; i++) {
      for (let j = i + 1; j < 4; j++) {
        const pairA = [playerIds[i], playerIds[j]].sort().join(',');
        const remaining = playerIds.filter(id => id !== playerIds[i] && id !== playerIds[j]);
        const pairB = [...remaining].sort().join(',');

        if (!previousPairings.has(pairA) && !previousPairings.has(pairB)) {
          return {
            teamA: [playerIds[i], playerIds[j]],
            teamB: remaining
          };
        }
      }
    }

    // Fallback to first 2 vs last 2
    return {
      teamA: [playerIds[0], playerIds[1]],
      teamB: [playerIds[2], playerIds[3]]
    };
  };

  // Auto-assign if 4 players and no existing assignment
  useEffect(() => {
    if (players.length === 4 && !existingTeamA && !existingTeamB && teamA.length === 0 && teamB.length === 0) {
      const playerIds = players.map(p => p.id);
      
      if (stretch === 1 || previousStretchTeams.length === 0) {
        // Stretch 1: Default first 2 vs last 2
        setTeamA([players[0].id, players[1].id]);
        setTeamB([players[2].id, players[3].id]);
      } else {
        // Stretch 2 or 3: Use rotation to avoid repeat pairings
        const rotated = getRotatedTeams(playerIds, previousStretchTeams);
        setTeamA(rotated.teamA);
        setTeamB(rotated.teamB);
      }
    }
  }, [players, existingTeamA, existingTeamB, stretch, previousStretchTeams]);

  const handlePlayerToggle = (playerId: string) => {
    // If in Team A, move to Team B
    if (teamA.includes(playerId)) {
      setTeamA(prev => prev.filter(id => id !== playerId));
      if (teamB.length < 2) {
        setTeamB(prev => [...prev, playerId]);
      }
    }
    // If in Team B, move to Team A
    else if (teamB.includes(playerId)) {
      setTeamB(prev => prev.filter(id => id !== playerId));
      if (teamA.length < 2) {
        setTeamA(prev => [...prev, playerId]);
      }
    }
    // If unassigned, add to first available team
    else {
      if (teamA.length < 2) {
        setTeamA(prev => [...prev, playerId]);
      } else if (teamB.length < 2) {
        setTeamB(prev => [...prev, playerId]);
      }
    }
  };

  const swapTeams = () => {
    const tempA = [...teamA];
    setTeamA([...teamB]);
    setTeamB(tempA);
  };

  const getPlayerTeam = (playerId: string): 'A' | 'B' | null => {
    if (teamA.includes(playerId)) return 'A';
    if (teamB.includes(playerId)) return 'B';
    return null;
  };

  const canConfirm = teamA.length === 2 && teamB.length === 2;

  const stretchHoles = {
    1: '1-6',
    2: '7-12',
    3: '13-18'
  };

  return (
    <div className="bg-card rounded-2xl shadow-lg border border-primary/30 p-4 space-y-4">
      <div className="text-center">
        <div className="flex items-center justify-center gap-2 mb-1">
          <span className="text-2xl">6️⃣</span>
          <h2 className="text-xl font-bold text-foreground">Stockton 6's</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Stretch {stretch}: Holes {stretchHoles[stretch]}
        </p>
      </div>

      <div className="text-center mb-4">
        <span className="text-xs uppercase tracking-wide text-muted-foreground font-bold">
          Assign Teams (2v2)
        </span>
      </div>

      {/* Team Assignment */}
      <div className="flex gap-2">
        {/* Team A */}
        <div className="flex-1 bg-primary/10 rounded-xl p-3 border-2 border-primary/30">
          <div className="text-center mb-2">
            <span className="text-xs font-bold text-primary uppercase">Team A</span>
          </div>
          <div className="space-y-2">
            {teamA.map(pid => {
              const player = players.find(p => p.id === pid);
              return player ? (
                <button
                  key={pid}
                  onClick={() => handlePlayerToggle(pid)}
                  className="w-full bg-primary text-primary-foreground rounded-lg py-2 px-3 text-sm font-bold flex items-center justify-between"
                >
                  {player.name}
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : null;
            })}
            {teamA.length < 2 && (
              <div className="border-2 border-dashed border-primary/30 rounded-lg py-2 px-3 text-sm text-primary/50 text-center">
                Select player
              </div>
            )}
          </div>
        </div>

        {/* Swap button */}
        <div className="flex items-center">
          <button
            onClick={swapTeams}
            className="bg-muted p-2 rounded-full hover:bg-muted/80 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Team B */}
        <div className="flex-1 bg-destructive/10 rounded-xl p-3 border-2 border-destructive/30">
          <div className="text-center mb-2">
            <span className="text-xs font-bold text-destructive uppercase">Team B</span>
          </div>
          <div className="space-y-2">
            {teamB.map(pid => {
              const player = players.find(p => p.id === pid);
              return player ? (
                <button
                  key={pid}
                  onClick={() => handlePlayerToggle(pid)}
                  className="w-full bg-destructive text-destructive-foreground rounded-lg py-2 px-3 text-sm font-bold flex items-center justify-between"
                >
                  <ArrowLeft className="w-4 h-4" />
                  {player.name}
                </button>
              ) : null;
            })}
            {teamB.length < 2 && (
              <div className="border-2 border-dashed border-destructive/30 rounded-lg py-2 px-3 text-sm text-destructive/50 text-center">
                Select player
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Unassigned players */}
      {players.some(p => !teamA.includes(p.id) && !teamB.includes(p.id)) && (
        <div className="bg-muted rounded-xl p-3">
          <div className="text-center mb-2">
            <span className="text-xs font-bold text-muted-foreground uppercase">Tap to assign</span>
          </div>
          <div className="flex flex-wrap gap-2 justify-center">
            {players.filter(p => !teamA.includes(p.id) && !teamB.includes(p.id)).map(player => (
              <button
                key={player.id}
                onClick={() => handlePlayerToggle(player.id)}
                className="bg-card text-foreground rounded-lg py-2 px-4 text-sm font-medium border border-border hover:border-primary transition-colors"
              >
                {player.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Bet Configuration */}
      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
        <div className="bg-muted rounded-xl p-3">
          <div className="text-center mb-2">
            <span className="text-xs font-bold text-muted-foreground uppercase">Unit Value</span>
          </div>
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => setUnitValue(v => Math.max(1, v - 1))}
              className="bg-card border border-border w-8 h-8 rounded-lg text-lg font-bold"
            >
              -
            </button>
            <span className="text-xl font-bold text-foreground min-w-[60px] text-center">${unitValue}</span>
            <button
              onClick={() => setUnitValue(v => v + 1)}
              className="bg-card border border-border w-8 h-8 rounded-lg text-lg font-bold"
            >
              +
            </button>
          </div>
        </div>

        <div className="bg-muted rounded-xl p-3">
          <div className="text-center mb-2">
            <span className="text-xs font-bold text-muted-foreground uppercase">Dot Value</span>
          </div>
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => setDotValue(v => Math.max(1, v - 1))}
              className="bg-card border border-border w-8 h-8 rounded-lg text-lg font-bold"
            >
              -
            </button>
            <span className="text-xl font-bold text-foreground min-w-[60px] text-center">${dotValue}</span>
            <button
              onClick={() => setDotValue(v => v + 1)}
              className="bg-card border border-border w-8 h-8 rounded-lg text-lg font-bold"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 pt-2">
        <Button
          variant="outline"
          onClick={onCancel}
          className="flex-1"
        >
          Cancel
        </Button>
        <Button
          onClick={() => onConfirm(teamA, teamB, unitValue, dotValue)}
          disabled={!canConfirm}
          className="flex-1 gap-2"
        >
          <Check className="w-4 h-4" />
          Confirm Teams
        </Button>
      </div>
    </div>
  );
};

export default Stockton6TeamSetup;
