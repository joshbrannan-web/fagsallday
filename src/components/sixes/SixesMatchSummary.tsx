import React from 'react';
import { Round, GameSettings, Player, SixesPressState } from '../../types';
import { 
  getSixesTeamAssignment, 
  calculateSixesStretchResult, 
  calculateSixesStretchPayouts,
  getSixesPresses,
  calculateSixesPressPayouts,
  calculateSixesHoleResult,
  getSixesMode,
  getAllStretches,
  getStretchName,
  getStretchEndHole,
  SixesStretch,
  SixesMode 
} from '../../services/sixesEngine';
import { Trophy, TrendingDown, Minus, Flame } from 'lucide-react';

interface SixesMatchSummaryProps {
  round: Round;
  game: GameSettings;
}

interface StretchData {
  stretch: SixesStretch;
  assignment: ReturnType<typeof getSixesTeamAssignment>;
  result: ReturnType<typeof calculateSixesStretchResult>;
  payouts: ReturnType<typeof calculateSixesStretchPayouts>;
  presses: SixesPressState[];
  pressPayouts: ReturnType<typeof calculateSixesPressPayouts>;
}

const StretchCard: React.FC<{ data: StretchData; round: Round; unitValue: number; mode: SixesMode }> = ({ 
  data, 
  round, 
  unitValue,
  mode 
}) => {
  const { stretch, assignment, result, payouts, presses, pressPayouts } = data;
  
  if (!assignment) return null;
  
  const getPlayerName = (playerId: string): string => {
    return round.players.find(p => p.id === playerId)?.name || 'Unknown';
  };
  
  const teamANames = assignment.teamA.map(getPlayerName).join(' & ');
  const teamBNames = assignment.teamB.map(getPlayerName).join(' & ');
  
  const stretchHoles = getStretchName(stretch, mode);
  const holesPerStretch = mode === 'threes' ? 3 : 6;
  
  const isComplete = result?.complete || false;
  const teamAWins = result?.teamAWins || 0;
  const teamBWins = result?.teamBWins || 0;
  const ties = result?.ties || 0;
  const holesPlayed = teamAWins + teamBWins + ties;
  const holesRemaining = holesPerStretch - holesPlayed;
  
  const winner: 'A' | 'B' | 'PUSH' | null = isComplete 
    ? (teamAWins > teamBWins ? 'A' : teamBWins > teamAWins ? 'B' : 'PUSH')
    : null;
  
  // Get payout amounts
  const teamAPlayerPayout = payouts?.playerPayouts[assignment.teamA[0]] || 0;
  const teamBPlayerPayout = payouts?.playerPayouts[assignment.teamB[0]] || 0;
  
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      {/* Stretch Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-muted/50">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">Stretch {stretch}</span>
          <span className="text-xs text-muted-foreground">({stretchHoles})</span>
        </div>
        {isComplete ? (
          <span className="text-xs px-2 py-0.5 bg-success/10 text-success rounded-full font-medium">Complete</span>
        ) : (
          <span className="text-xs px-2 py-0.5 bg-amber-500/10 text-amber-600 rounded-full font-medium">
            In Progress ({holesRemaining} remaining)
          </span>
        )}
      </div>
      
      {/* Teams Section */}
      <div className="p-3 space-y-2">
        {/* Team A */}
        <div className={`flex items-center justify-between px-3 py-2 rounded-lg ${
          winner === 'A' ? 'bg-primary/10 border border-primary/30' : 
          winner === 'B' ? 'bg-destructive/5 border border-destructive/20' :
          'bg-muted/30 border border-transparent'
        }`}>
          <div className="flex items-center gap-2">
            {winner === 'A' && <Trophy className="w-4 h-4 text-primary" />}
            {winner === 'B' && <TrendingDown className="w-4 h-4 text-destructive" />}
            <div>
              <span className={`font-semibold text-sm ${winner === 'A' ? 'text-primary' : 'text-foreground'}`}>
                Team A
              </span>
              <span className="text-xs text-muted-foreground ml-2">{teamANames}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold">{teamAWins}</span>
            {isComplete && (
              <span className={`font-mono font-bold text-sm min-w-[60px] text-right ${
                teamAPlayerPayout > 0 ? 'text-success' : 
                teamAPlayerPayout < 0 ? 'text-destructive' : 
                'text-muted-foreground'
              }`}>
                {teamAPlayerPayout > 0 ? `+$${teamAPlayerPayout}` : 
                 teamAPlayerPayout < 0 ? `-$${Math.abs(teamAPlayerPayout)}` : 
                 'Push'}
              </span>
            )}
          </div>
        </div>
        
        {/* Team B */}
        <div className={`flex items-center justify-between px-3 py-2 rounded-lg ${
          winner === 'B' ? 'bg-destructive/10 border border-destructive/30' : 
          winner === 'A' ? 'bg-primary/5 border border-primary/20' :
          'bg-muted/30 border border-transparent'
        }`}>
          <div className="flex items-center gap-2">
            {winner === 'B' && <Trophy className="w-4 h-4 text-destructive" />}
            {winner === 'A' && <TrendingDown className="w-4 h-4 text-primary" />}
            <div>
              <span className={`font-semibold text-sm ${winner === 'B' ? 'text-destructive' : 'text-foreground'}`}>
                Team B
              </span>
              <span className="text-xs text-muted-foreground ml-2">{teamBNames}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold">{teamBWins}</span>
            {isComplete && (
              <span className={`font-mono font-bold text-sm min-w-[60px] text-right ${
                teamBPlayerPayout > 0 ? 'text-success' : 
                teamBPlayerPayout < 0 ? 'text-destructive' : 
                'text-muted-foreground'
              }`}>
                {teamBPlayerPayout > 0 ? `+$${teamBPlayerPayout}` : 
                 teamBPlayerPayout < 0 ? `-$${Math.abs(teamBPlayerPayout)}` : 
                 'Push'}
              </span>
            )}
          </div>
        </div>
        
        {/* Ties info */}
        {ties > 0 && (
          <div className="flex items-center justify-center gap-1 py-1 text-xs text-muted-foreground">
            <Minus className="w-3 h-3" />
            <span>{ties} hole{ties !== 1 ? 's' : ''} tied</span>
          </div>
        )}
      </div>
      
      {/* Press Section */}
      {presses.length > 0 && (
        <div className="border-t border-border px-3 py-2 bg-amber-500/5">
          {presses.map((press, idx) => {
            const stretchEndHole = getStretchEndHole(stretch, mode);
            
            // Calculate press result
            let teamAWinsInPress = 0;
            let teamBWinsInPress = 0;
            let holesInPressPlayed = 0;
            
            for (let h = press.startHole; h <= stretchEndHole; h++) {
              const holeScores = round.scores[h];
              if (!holeScores) continue;
              
              // Check if hole is complete
              const allPlayers = [...assignment.teamA, ...assignment.teamB];
              const allHaveScores = allPlayers.every(pid => typeof holeScores[pid] === 'number');
              if (!allHaveScores) continue;
              
              holesInPressPlayed++;
              
              // Use the proper engine function for correct calculation
              const holeResult = calculateSixesHoleResult(
                round,
                h,
                assignment.teamA,
                assignment.teamB,
                assignment.useHandicaps,
                assignment.useSecondBallTiebreaker || false,
                assignment.handicapMode || 'absolute'
              );
              
              if (holeResult === 'A') teamAWinsInPress++;
              else if (holeResult === 'B') teamBWinsInPress++;
            }
            
            const totalPressHoles = stretchEndHole - press.startHole + 1;
            const isPressComplete = holesInPressPlayed >= totalPressHoles;
            const pressHolesRemaining = totalPressHoles - holesInPressPlayed;
            
            const pressWinner: 'A' | 'B' | 'PUSH' | null = isPressComplete 
              ? (teamAWinsInPress > teamBWinsInPress ? 'A' : teamBWinsInPress > teamAWinsInPress ? 'B' : 'PUSH')
              : null;
            
            const pressingTeamName = press.teamDormie === 'A' ? 'Team A' : 'Team B';
            
            // Get press payout for the pressing team
            const pressPayoutAmount = press.unitValue;
            const pressingTeamWon = pressWinner === press.teamDormie;
            
            return (
              <div key={idx} className="flex flex-col gap-1 py-1">
                <div className="flex items-center gap-2">
                  <Flame className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-xs font-semibold text-amber-700">
                    {pressingTeamName} pressed on Hole {press.startHole}
                  </span>
                  {!isPressComplete && (
                    <span className="text-xs text-amber-500 ml-auto">({pressHolesRemaining} remaining)</span>
                  )}
                </div>
                
                <div className="ml-5 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    Holes {press.startHole}-{stretchEndHole}: 
                    <span className={`ml-1 font-medium ${
                      isPressComplete 
                        ? (pressWinner === 'A' ? 'text-primary' : pressWinner === 'B' ? 'text-destructive' : 'text-muted-foreground')
                        : ''
                    }`}>
                      {isPressComplete 
                        ? (pressWinner === 'PUSH' 
                            ? `Push ${teamAWinsInPress}-${teamBWinsInPress}` 
                            : `Team ${pressWinner} wins ${pressWinner === 'A' ? teamAWinsInPress : teamBWinsInPress}-${pressWinner === 'A' ? teamBWinsInPress : teamAWinsInPress}`)
                        : `Team A ${teamAWinsInPress} - Team B ${teamBWinsInPress}`
                      }
                    </span>
                  </span>
                  
                  {isPressComplete && pressWinner !== 'PUSH' && (
                    <span className={`font-mono font-bold ${pressingTeamWon ? 'text-success' : 'text-destructive'}`}>
                      {pressingTeamWon ? `+$${pressPayoutAmount}` : `-$${pressPayoutAmount}`}/each
                    </span>
                  )}
                  {isPressComplete && pressWinner === 'PUSH' && (
                    <span className="text-muted-foreground font-medium">Push</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const RoundTotalsFooter: React.FC<{ 
  stretchData: StretchData[];
  players: Player[];
  unitValue: number;
}> = ({ stretchData, players, unitValue }) => {
  // Calculate total payouts per player across all stretches and presses
  const playerTotals: { [playerId: string]: number } = {};
  const playerWins: { [playerId: string]: number } = {};
  const playerLosses: { [playerId: string]: number } = {};
  
  players.forEach(p => {
    playerTotals[p.id] = 0;
    playerWins[p.id] = 0;
    playerLosses[p.id] = 0;
  });
  
  stretchData.forEach(data => {
    // Add stretch payouts
    if (data.payouts?.playerPayouts) {
      Object.entries(data.payouts.playerPayouts).forEach(([playerId, amount]) => {
        playerTotals[playerId] = (playerTotals[playerId] || 0) + amount;
        if (amount > 0) playerWins[playerId] = (playerWins[playerId] || 0) + 1;
        else if (amount < 0) playerLosses[playerId] = (playerLosses[playerId] || 0) + 1;
      });
    }
    
    // Add press payouts
    if (data.pressPayouts?.playerPayouts) {
      Object.entries(data.pressPayouts.playerPayouts).forEach(([playerId, amount]) => {
        playerTotals[playerId] = (playerTotals[playerId] || 0) + amount;
        if (amount > 0) playerWins[playerId] = (playerWins[playerId] || 0) + 1;
        else if (amount < 0) playerLosses[playerId] = (playerLosses[playerId] || 0) + 1;
      });
    }
  });
  
  // Check if any payouts exist
  const hasPayouts = Object.values(playerTotals).some(v => v !== 0);
  if (!hasPayouts) return null;
  
  return (
    <div className="border-t border-primary/20 bg-primary/5 px-4 py-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="font-bold text-sm text-foreground">Round Totals</span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {players.slice(0, 4).map(player => {
          const total = playerTotals[player.id] || 0;
          const wins = playerWins[player.id] || 0;
          const losses = playerLosses[player.id] || 0;
          
          return (
            <div 
              key={player.id} 
              className={`flex flex-col items-center p-2 rounded-lg ${
                total > 0 ? 'bg-success/10 border border-success/20' :
                total < 0 ? 'bg-destructive/10 border border-destructive/20' :
                'bg-muted/50'
              }`}
            >
              <span className="text-xs font-medium text-muted-foreground truncate max-w-full">
                {player.name}
              </span>
              <span className={`font-mono font-bold ${
                total > 0 ? 'text-success' : 
                total < 0 ? 'text-destructive' : 
                'text-muted-foreground'
              }`}>
                {total > 0 ? `+$${total}` : total < 0 ? `-$${Math.abs(total)}` : '$0'}
              </span>
              <span className="text-xs text-muted-foreground">
                ({wins}W {losses}L)
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const SixesMatchSummary: React.FC<SixesMatchSummaryProps> = ({ round, game }) => {
  const mode = getSixesMode(round.gameData, game.id);
  const stretches = getAllStretches(mode);
  const gameModeLabel = mode === 'threes' ? "3's" : "6's";
  
  const stretchData: StretchData[] = stretches.map(stretch => ({
    stretch,
    assignment: getSixesTeamAssignment(round.gameData, game.id, stretch, mode),
    result: calculateSixesStretchResult(round, game, stretch, mode),
    payouts: calculateSixesStretchPayouts(round, game, stretch, mode),
    presses: getSixesPresses(round.gameData, game.id, stretch, mode),
    pressPayouts: calculateSixesPressPayouts(round, game, stretch, mode),
  }));
  
  // Filter out stretches that haven't started (no team assignment)
  const activeStretches = stretchData.filter(d => d.assignment !== null);
  
  if (activeStretches.length === 0) {
    return (
      <div className="mt-4 bg-card rounded-xl shadow-sm border border-primary/30 overflow-hidden">
        <div className="bg-primary/10 px-4 py-3 border-b border-primary/20">
          <div className="flex items-center gap-2">
            <span className="text-lg">⚔️</span>
            <h3 className="font-bold text-foreground">{gameModeLabel} Match Play Results</h3>
            <span className="text-xs text-muted-foreground ml-auto">${game.unitStake} per stretch</span>
          </div>
        </div>
        <div className="p-4 text-center text-muted-foreground text-sm">
          No matches started yet
        </div>
      </div>
    );
  }
  
  const unitValue = stretchData[0]?.assignment?.unitValue || game.unitStake;
  
  return (
    <div className="mt-4 bg-card rounded-xl shadow-sm border border-primary/30 overflow-hidden">
      {/* Header */}
      <div className="bg-primary/10 px-4 py-3 border-b border-primary/20">
        <div className="flex items-center gap-2">
          <span className="text-lg">⚔️</span>
          <h3 className="font-bold text-foreground">{gameModeLabel} Match Play Results</h3>
          <span className="text-xs text-muted-foreground ml-auto">${unitValue} per stretch</span>
        </div>
      </div>
      
      {/* Stretch Cards */}
      <div className="p-4 space-y-3">
        {stretchData.map(data => (
          <StretchCard 
            key={data.stretch} 
            data={data} 
            round={round} 
            unitValue={unitValue}
            mode={mode}
          />
        ))}
      </div>
      
      {/* Round Totals */}
      <RoundTotalsFooter 
        stretchData={stretchData} 
        players={round.players} 
        unitValue={unitValue}
      />
    </div>
  );
};

export default SixesMatchSummary;
