import React, { useState, useEffect } from 'react';
import { Player, GameSettings, GameType } from '@/types';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Users, ArrowRight, ArrowLeft, Check } from 'lucide-react';

interface TeamSetupStepProps {
  players: Player[];
  selectedGames: GameSettings[];
  onConfirm: (initialGameData: Record<string, any>) => void;
  onBack: () => void;
}

const TeamSetupStep: React.FC<TeamSetupStepProps> = ({
  players,
  selectedGames,
  onConfirm,
  onBack
}) => {
  // Stockton 6's state
  const stockton6Game = selectedGames.find(g => g.type === GameType.STOCKTON_6);
  const [stockton6TeamA, setStockton6TeamA] = useState<string[]>([]);
  const [stockton6TeamB, setStockton6TeamB] = useState<string[]>([]);
  const [stockton6UnitValue, setStockton6UnitValue] = useState(stockton6Game?.unitStake ?? 5);
  const [stockton6DotValue, setStockton6DotValue] = useState(
    stockton6Game?.config?.stockton6?.dotValue ?? 2
  );

  // 6's state
  const sixesGame = selectedGames.find(g => g.type === GameType.SIXES);
  const [sixesTeamA, setSixesTeamA] = useState<string[]>([]);
  const [sixesTeamB, setSixesTeamB] = useState<string[]>([]);
  const [sixesUnitValue, setSixesUnitValue] = useState(sixesGame?.unitStake ?? 10);
  const [sixesUseHandicaps, setSixesUseHandicaps] = useState(
    sixesGame?.config?.useHandicaps ?? true
  );
  const [sixesUseSecondBall, setSixesUseSecondBall] = useState(
    sixesGame?.config?.sixes?.useSecondBallTiebreaker ?? false
  );

  // Auto-assign teams if 4 players
  useEffect(() => {
    const playerIds = players.map(p => p.id);
    if (playerIds.length === 4) {
      if (stockton6Game && stockton6TeamA.length === 0 && stockton6TeamB.length === 0) {
        setStockton6TeamA([playerIds[0], playerIds[1]]);
        setStockton6TeamB([playerIds[2], playerIds[3]]);
      }
      if (sixesGame && sixesTeamA.length === 0 && sixesTeamB.length === 0) {
        setSixesTeamA([playerIds[0], playerIds[1]]);
        setSixesTeamB([playerIds[2], playerIds[3]]);
      }
    }
  }, [players, stockton6Game, sixesGame]);

  const handlePlayerToggle = (
    playerId: string,
    teamA: string[],
    setTeamA: (v: string[]) => void,
    teamB: string[],
    setTeamB: (v: string[]) => void
  ) => {
    if (teamA.includes(playerId)) {
      setTeamA(teamA.filter(id => id !== playerId));
      if (teamB.length < 2) {
        setTeamB([...teamB, playerId]);
      }
    } else if (teamB.includes(playerId)) {
      setTeamB(teamB.filter(id => id !== playerId));
      if (teamA.length < 2) {
        setTeamA([...teamA, playerId]);
      }
    } else {
      if (teamA.length < 2) {
        setTeamA([...teamA, playerId]);
      } else if (teamB.length < 2) {
        setTeamB([...teamB, playerId]);
      }
    }
  };

  const swapTeams = (
    teamA: string[],
    setTeamA: (v: string[]) => void,
    teamB: string[],
    setTeamB: (v: string[]) => void
  ) => {
    const tempA = [...teamA];
    setTeamA([...teamB]);
    setTeamB(tempA);
  };

  const canConfirm = () => {
    if (stockton6Game && (stockton6TeamA.length !== 2 || stockton6TeamB.length !== 2)) {
      return false;
    }
    if (sixesGame && (sixesTeamA.length !== 2 || sixesTeamB.length !== 2)) {
      return false;
    }
    return true;
  };

  const handleConfirm = () => {
    const initialGameData: Record<string, any> = {};

    if (stockton6Game && stockton6TeamA.length === 2 && stockton6TeamB.length === 2) {
      initialGameData[stockton6Game.id] = {
        1: {  // Hole 1 is the stretch start hole
          _META_TEAM_A: stockton6TeamA,
          _META_TEAM_B: stockton6TeamB,
          _META_UNIT_VALUE: stockton6UnitValue,
          _META_DOT_VALUE: stockton6DotValue,
          _META_LOCKED: true,
        }
      };
    }

    if (sixesGame && sixesTeamA.length === 2 && sixesTeamB.length === 2) {
      initialGameData[sixesGame.id] = {
        1: {  // Hole 1 is the stretch start hole
          _META_TEAM_A: sixesTeamA,
          _META_TEAM_B: sixesTeamB,
          _META_UNIT_VALUE: sixesUnitValue,
          _META_USE_HANDICAPS: sixesUseHandicaps,
          _META_USE_SECOND_BALL: sixesUseSecondBall,
          _META_LOCKED: true,
        }
      };
    }

    onConfirm(initialGameData);
  };

  const renderTeamSection = (
    gameIcon: string,
    gameName: string,
    teamA: string[],
    setTeamA: (v: string[]) => void,
    teamB: string[],
    setTeamB: (v: string[]) => void,
    extraConfig?: React.ReactNode
  ) => (
    <div className="bg-card rounded-2xl shadow-lg border border-primary/30 p-4 space-y-4">
      <div className="text-center">
        <div className="flex items-center justify-center gap-2 mb-1">
          <span className="text-2xl">{gameIcon}</span>
          <h3 className="text-xl font-bold text-foreground">{gameName}</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Stretch 1: Holes 1-6
        </p>
      </div>

      <div className="text-center">
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
                  onClick={() => handlePlayerToggle(pid, teamA, setTeamA, teamB, setTeamB)}
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
            onClick={() => swapTeams(teamA, setTeamA, teamB, setTeamB)}
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
                  onClick={() => handlePlayerToggle(pid, teamA, setTeamA, teamB, setTeamB)}
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
                onClick={() => handlePlayerToggle(player.id, teamA, setTeamA, teamB, setTeamB)}
                className="bg-card text-foreground rounded-lg py-2 px-4 text-sm font-medium border border-border hover:border-primary transition-colors"
              >
                {player.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {extraConfig}
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
          <Users className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-bold">Team Setup</h2>
          <p className="text-sm text-muted-foreground">Configure teams for Stretch 1 (Holes 1-6)</p>
        </div>
      </div>

      {/* Stockton 6's Team Setup */}
      {stockton6Game && renderTeamSection(
        '6️⃣',
        "Stockton 6's",
        stockton6TeamA,
        setStockton6TeamA,
        stockton6TeamB,
        setStockton6TeamB,
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
          <div className="bg-muted rounded-xl p-3">
            <div className="text-center mb-2">
              <span className="text-xs font-bold text-muted-foreground uppercase">Unit Value</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setStockton6UnitValue(v => Math.max(1, v - 1))}
                className="bg-card border border-border w-8 h-8 rounded-lg text-lg font-bold"
              >
                -
              </button>
              <span className="text-xl font-bold text-foreground min-w-[60px] text-center">${stockton6UnitValue}</span>
              <button
                onClick={() => setStockton6UnitValue(v => v + 1)}
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
                onClick={() => setStockton6DotValue(v => Math.max(1, v - 1))}
                className="bg-card border border-border w-8 h-8 rounded-lg text-lg font-bold"
              >
                -
              </button>
              <span className="text-xl font-bold text-foreground min-w-[60px] text-center">${stockton6DotValue}</span>
              <button
                onClick={() => setStockton6DotValue(v => v + 1)}
                className="bg-card border border-border w-8 h-8 rounded-lg text-lg font-bold"
              >
                +
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6's Team Setup */}
      {sixesGame && renderTeamSection(
        '🎲',
        "6's",
        sixesTeamA,
        setSixesTeamA,
        sixesTeamB,
        setSixesTeamB,
        <div className="space-y-3 pt-2 border-t border-border">
          <div className="bg-muted rounded-xl p-3">
            <div className="text-center mb-2">
              <span className="text-xs font-bold text-muted-foreground uppercase">Bet Amount</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setSixesUnitValue(v => Math.max(5, v - 5))}
                className="bg-card border border-border px-3 h-8 rounded-lg text-sm font-bold"
              >
                -$5
              </button>
              <span className="text-xl font-bold text-foreground min-w-[60px] text-center">${sixesUnitValue}</span>
              <button
                onClick={() => setSixesUnitValue(v => v + 5)}
                className="bg-card border border-border px-3 h-8 rounded-lg text-sm font-bold"
              >
                +$5
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between px-3 py-2 bg-muted rounded-xl">
            <Label htmlFor="sixes-handicaps" className="text-sm font-medium">Use Handicaps</Label>
            <Switch
              id="sixes-handicaps"
              checked={sixesUseHandicaps}
              onCheckedChange={setSixesUseHandicaps}
            />
          </div>

          <div className="flex items-center justify-between px-3 py-2 bg-muted rounded-xl">
            <div>
              <Label htmlFor="sixes-second-ball" className="text-sm font-medium">2nd Ball Tiebreaker</Label>
              <p className="text-xs text-muted-foreground">If 1st balls tie, 2nd lowest net wins</p>
            </div>
            <Switch
              id="sixes-second-ball"
              checked={sixesUseSecondBall}
              onCheckedChange={setSixesUseSecondBall}
            />
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 pt-4">
        <Button
          variant="outline"
          onClick={onBack}
          className="flex-1"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Button
          onClick={handleConfirm}
          disabled={!canConfirm()}
          className="flex-1 gap-2"
        >
          <Check className="w-4 h-4" />
          Start Round
        </Button>
      </div>
    </div>
  );
};

export default TeamSetupStep;
