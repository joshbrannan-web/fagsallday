import React from 'react';
import { Round, GameSettings } from '@/types';
import { calculateStretchPayouts, getTeamAssignment, calculateBallState, countTeamDots, STRETCH_HOLES } from '@/services/stockton6Engine';
import { Trophy, TrendingDown, AlertCircle, Flame } from 'lucide-react';

interface Stockton6StretchSummaryProps {
  round: Round;
  game: GameSettings;
  stretch: 1 | 2 | 3;
}

const Stockton6StretchSummary: React.FC<Stockton6StretchSummaryProps> = ({
  round,
  game,
  stretch
}) => {
  const teamAssignment = getTeamAssignment(round.gameData, game.id, stretch);
  const stretchHoles = STRETCH_HOLES[stretch];
  
  if (!teamAssignment) {
    return (
      <div className="bg-card rounded-xl p-4 border border-border">
        <div className="flex items-center gap-2 text-muted-foreground">
          <AlertCircle className="w-5 h-5" />
          <span>No team assignment for Stretch {stretch}</span>
        </div>
      </div>
    );
  }
  
  const result = calculateStretchPayouts(round, game, stretch);
  const ballState = calculateBallState(round, game.id, stretch, stretch * 6);
  const teamADots = countTeamDots(round, game.id, stretch, teamAssignment.teamA);
  const teamBDots = countTeamDots(round, game.id, stretch, teamAssignment.teamB);
  
  const getTeamAName = () => teamAssignment.teamA.map(id => 
    round.players.find(p => p.id === id)?.name.split(' ')[0]
  ).join(' & ');
  
  const getTeamBName = () => teamAssignment.teamB.map(id => 
    round.players.find(p => p.id === id)?.name.split(' ')[0]
  ).join(' & ');

  const BallBreakdown = ({ 
    label, 
    frontUp, 
    frontPresses,
    backUp, 
    backPresses,
    overallUp,
    unitValue 
  }: { 
    label: string; 
    frontUp: number; 
    frontPresses: { teamAUp: number }[];
    backUp: number; 
    backPresses: { teamAUp: number }[];
    overallUp: number;
    unitValue: number;
  }) => {
    // Calculate units for each segment
    const frontUnits = (frontUp > 0 ? 1 : frontUp < 0 ? -1 : 0) + 
      frontPresses.reduce((sum, p) => sum + (p.teamAUp > 0 ? 1 : p.teamAUp < 0 ? -1 : 0), 0);
    const backUnits = (backUp > 0 ? 2 : backUp < 0 ? -2 : 0) + 
      backPresses.reduce((sum, p) => sum + (p.teamAUp > 0 ? 1 : p.teamAUp < 0 ? -1 : 0), 0);
    const overallUnits = overallUp > 0 ? 1 : overallUp < 0 ? -1 : 0;
    const totalUnits = frontUnits + backUnits + overallUnits;
    
    return (
      <div className="bg-muted/50 rounded-lg p-3">
        <div className="font-bold text-foreground mb-2">{label}</div>
        <div className="grid grid-cols-4 gap-2 text-xs">
          <div>
            <span className="text-muted-foreground">Front</span>
            <div className={`font-bold flex items-center gap-1 ${frontUnits > 0 ? 'text-primary' : frontUnits < 0 ? 'text-destructive' : ''}`}>
              {frontUnits > 0 ? '+' : ''}{frontUnits}u
              {frontPresses.length > 0 && (
                <span className="inline-flex items-center gap-0.5">
                  <Flame className="w-3 h-3 text-orange-500" />
                  <span className="text-xs text-orange-500 font-medium">x{frontPresses.length}</span>
                </span>
              )}
            </div>
          </div>
          <div>
            <span className="text-muted-foreground">Back</span>
            <div className={`font-bold flex items-center gap-1 ${backUnits > 0 ? 'text-primary' : backUnits < 0 ? 'text-destructive' : ''}`}>
              {backUnits > 0 ? '+' : ''}{backUnits}u
              {backPresses.length > 0 && (
                <span className="inline-flex items-center gap-0.5">
                  <Flame className="w-3 h-3 text-orange-500" />
                  <span className="text-xs text-orange-500 font-medium">x{backPresses.length}</span>
                </span>
              )}
            </div>
          </div>
          <div>
            <span className="text-muted-foreground">Overall</span>
            <div className={`font-bold ${overallUnits > 0 ? 'text-primary' : overallUnits < 0 ? 'text-destructive' : ''}`}>
              {overallUnits > 0 ? '+' : ''}{overallUnits}u
            </div>
          </div>
          <div>
            <span className="text-muted-foreground">Total</span>
            <div className={`font-bold ${totalUnits > 0 ? 'text-primary' : totalUnits < 0 ? 'text-destructive' : ''}`}>
              {totalUnits > 0 ? '+' : ''}${totalUnits * unitValue}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-card rounded-xl shadow-lg border border-primary/30 p-4 space-y-4">
      <div className="text-center">
        <div className="flex items-center justify-center gap-2 mb-1">
          <span className="text-2xl">6️⃣</span>
          <h2 className="text-xl font-bold text-foreground">Stretch {stretch} Summary</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Holes {stretchHoles[0]}-{stretchHoles[5]}
        </p>
      </div>

      {/* Teams */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-primary/10 rounded-lg p-2 text-center">
          <div className="text-xs text-muted-foreground uppercase">Team A</div>
          <div className="font-bold text-primary">{getTeamAName()}</div>
        </div>
        <div className="bg-destructive/10 rounded-lg p-2 text-center">
          <div className="text-xs text-muted-foreground uppercase">Team B</div>
          <div className="font-bold text-destructive">{getTeamBName()}</div>
        </div>
      </div>

      {!result ? (
        <div className="text-center py-4 text-muted-foreground">
          <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>Stretch not complete yet</p>
          <p className="text-xs">Complete all 6 holes to see results</p>
        </div>
      ) : (
        <>
          {/* Ball breakdowns */}
          {ballState && (
            <div className="space-y-2">
              <BallBreakdown
                label="1-Ball (Low Net vs Low Net)"
                frontUp={ballState.oneBall.front.teamAUp}
                frontPresses={ballState.oneBall.front.presses}
                backUp={ballState.oneBall.back.teamAUp}
                backPresses={ballState.oneBall.back.presses}
                overallUp={ballState.oneBall.overall.teamAUp}
                unitValue={teamAssignment.unitValue}
              />
              <BallBreakdown
                label="2-Ball (High Net vs High Net)"
                frontUp={ballState.twoBall.front.teamAUp}
                frontPresses={ballState.twoBall.front.presses}
                backUp={ballState.twoBall.back.teamAUp}
                backPresses={ballState.twoBall.back.presses}
                overallUp={ballState.twoBall.overall.teamAUp}
                unitValue={teamAssignment.unitValue}
              />
            </div>
          )}

          {/* Dots summary */}
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="font-bold text-foreground mb-2">Dots</div>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div className="text-center">
                <div className="text-muted-foreground text-xs">Team A</div>
                <div className="font-bold text-primary">{teamADots}</div>
              </div>
              <div className="text-center">
                <div className="text-muted-foreground text-xs">Team B</div>
                <div className="font-bold text-destructive">{teamBDots}</div>
              </div>
              <div className="text-center">
                <div className="text-muted-foreground text-xs">Net × ${teamAssignment.dotValue}</div>
                <div className={`font-bold ${teamADots - teamBDots > 0 ? 'text-primary' : teamADots - teamBDots < 0 ? 'text-destructive' : ''}`}>
                  {teamADots - teamBDots > 0 ? '+' : ''}${(teamADots - teamBDots) * teamAssignment.dotValue}
                </div>
              </div>
            </div>
          </div>

          {/* Player results */}
          <div className="space-y-2">
            <h4 className="font-bold text-foreground text-sm uppercase tracking-wide">Player Results</h4>
            {Object.entries(result.playerPayouts)
              .sort(([, a], [, b]) => b - a)
              .map(([playerId, amount]) => {
                const player = round.players.find(p => p.id === playerId);
                const team = teamAssignment.teamA.includes(playerId) ? 'A' : 'B';
                
                return (
                  <div 
                    key={playerId}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      amount > 0 ? 'bg-green-500/10' : amount < 0 ? 'bg-red-500/10' : 'bg-muted'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {amount > 0 ? (
                        <Trophy className="w-5 h-5 text-yellow-500" />
                      ) : amount < 0 ? (
                        <TrendingDown className="w-5 h-5 text-destructive" />
                      ) : null}
                      <div>
                        <div className="font-bold text-foreground">{player?.name}</div>
                        <div className={`text-xs ${team === 'A' ? 'text-primary' : 'text-destructive'}`}>
                          Team {team}
                        </div>
                      </div>
                    </div>
                    <div className={`text-xl font-bold ${
                      amount > 0 ? 'text-green-500' : amount < 0 ? 'text-red-500' : 'text-muted-foreground'
                    }`}>
                      {amount > 0 ? '+' : ''}${amount}
                    </div>
                  </div>
                );
              })}
          </div>
        </>
      )}
    </div>
  );
};

export default Stockton6StretchSummary;
