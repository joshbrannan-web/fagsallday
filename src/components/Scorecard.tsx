import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../App';
import { ArrowLeft, Home, Play, Crown, Trophy, TrendingDown, Minus } from 'lucide-react';
import { calculateAggregatedHolePnL } from '../services/gameEngine';
import { calculateRelativeStrokes, getWeightedDotCount, STRETCH_HOLES, getHolePressInfo } from '../services/stockton6Engine';
import { getSixesTeamAssignment, calculateSixesHoleResult, calculateSixesStretchResult, getSixesStretchForHole } from '../services/sixesEngine';
import { Button } from '@/components/ui/button';
import { GameType, GameSettings, Player, HoleScores, GameData, Hole, WolfHoleData } from '../types';

// FBO Segment Results Component
interface FBOSegmentResultsProps {
  fboGame: GameSettings;
  fboPlayers: Player[];
  scores: { [holeNumber: number]: HoleScores };
  gameData: GameData;
  courseHoles: Hole[];
}

const FBOSegmentResults: React.FC<FBOSegmentResultsProps> = ({
  fboGame,
  fboPlayers,
  scores,
  gameData,
  courseHoles,
}) => {
  const unit = fboGame.unitStake;
  const fboData = gameData?.[fboGame.id] || {};

  // Check completed holes
  const completedHoles = new Set<number>();
  for (let h = 1; h <= courseHoles.length; h++) {
    const holeScores = scores[h];
    if (!holeScores) continue;
    const allPlayersScored = fboPlayers.every(p => {
      const score = holeScores[p.id];
      return score !== undefined && score !== null && score > 0;
    });
    if (allPlayersScored) {
      completedHoles.add(h);
    }
  }

  const frontNineComplete = [1, 2, 3, 4, 5, 6, 7, 8, 9].every(h => completedHoles.has(h));
  const backNineComplete = [10, 11, 12, 13, 14, 15, 16, 17, 18].every(h => completedHoles.has(h));
  const overallComplete = frontNineComplete && backNineComplete;

  // Count dots per segment
  const dotCounts = { front: {} as { [id: string]: number }, back: {} as { [id: string]: number }, overall: {} as { [id: string]: number } };
  fboPlayers.forEach(p => {
    dotCounts.front[p.id] = 0;
    dotCounts.back[p.id] = 0;
    dotCounts.overall[p.id] = 0;
  });

  for (let h = 1; h <= courseHoles.length; h++) {
    const holeDots = fboData[h]?.dots || [];
    holeDots.forEach((playerId: string) => {
      if (dotCounts.overall[playerId] !== undefined) {
        dotCounts.overall[playerId]++;
        if (h <= 9) dotCounts.front[playerId]++;
        else dotCounts.back[playerId]++;
      }
    });
  }

  // Calculate segment result
  const getSegmentResult = (segment: { [id: string]: number }, isComplete: boolean) => {
    if (!isComplete) return { status: 'pending' as const, winners: [], losers: [], amounts: {} as { [id: string]: number } };
    
    const maxDots = Math.max(...Object.values(segment));
    if (maxDots === 0) return { status: 'push' as const, winners: [], losers: [], amounts: {} as { [id: string]: number } };
    
    const winners = Object.entries(segment).filter(([_, dots]) => dots === maxDots).map(([id]) => id);
    const losers = Object.entries(segment).filter(([_, dots]) => dots < maxDots).map(([id]) => id);
    
    const amounts: { [id: string]: number } = {};
    fboPlayers.forEach(p => amounts[p.id] = 0);
    
    if (winners.length === 1) {
      amounts[winners[0]] = unit * losers.length;
      losers.forEach(id => amounts[id] = -unit);
    } else if (losers.length > 0) {
      const totalFromLosers = unit * losers.length;
      const perWinner = totalFromLosers / winners.length;
      winners.forEach(id => amounts[id] = perWinner);
      losers.forEach(id => amounts[id] = -unit);
    }
    
    return { status: 'settled' as const, winners, losers, amounts };
  };

  const frontResult = getSegmentResult(dotCounts.front, frontNineComplete);
  const backResult = getSegmentResult(dotCounts.back, backNineComplete);
  const overallResult = getSegmentResult(dotCounts.overall, overallComplete);

  const segments = [
    { label: 'Front 9', result: frontResult, dots: dotCounts.front, complete: frontNineComplete },
    { label: 'Back 9', result: backResult, dots: dotCounts.back, complete: backNineComplete },
    { label: 'Overall', result: overallResult, dots: dotCounts.overall, complete: overallComplete },
  ];

  return (
    <div className="mt-4 inline-block min-w-full bg-card rounded-xl shadow-sm border border-brand-gold/30 overflow-hidden">
      <div className="bg-brand-gold/10 px-4 py-2 border-b border-brand-gold/20">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-brand-gold" />
          <h3 className="font-bold text-foreground">FBO Results</h3>
          <span className="text-xs text-muted-foreground ml-auto">${unit} per segment × 3 segments</span>
        </div>
      </div>
      <div className="p-4 space-y-3">
        {segments.map(({ label, result, dots, complete }) => (
          <div key={label} className={`rounded-lg p-3 ${complete ? 'bg-muted/50' : 'bg-muted/20'}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-sm">{label}</span>
              {!complete ? (
                <span className="text-xs text-muted-foreground px-2 py-0.5 bg-muted rounded-full">In Progress</span>
              ) : result.status === 'push' ? (
                <span className="text-xs text-muted-foreground px-2 py-0.5 bg-muted rounded-full flex items-center gap-1">
                  <Minus className="w-3 h-3" /> Push
                </span>
              ) : (
                <span className="text-xs text-success px-2 py-0.5 bg-success/10 rounded-full">Settled</span>
              )}
            </div>
            <div className="grid gap-1">
              {fboPlayers.map(player => {
                const isWinner = result.winners.includes(player.id);
                const isLoser = result.losers.includes(player.id);
                const amount = result.amounts[player.id] || 0;
                const playerDots = dots[player.id] || 0;
                
                return (
                  <div 
                    key={player.id} 
                    className={`flex items-center justify-between px-3 py-2 rounded-md text-sm ${
                      isWinner ? 'bg-success/10 border border-success/20' : 
                      isLoser ? 'bg-destructive/10 border border-destructive/20' : 
                      'bg-background/50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {isWinner && <Trophy className="w-4 h-4 text-brand-gold" />}
                      {isLoser && <TrendingDown className="w-4 h-4 text-destructive" />}
                      <span className={isWinner ? 'font-semibold' : ''}>{player.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">{playerDots} dot{playerDots !== 1 ? 's' : ''}</span>
                      {complete && result.status === 'settled' && (
                        <span className={`font-mono font-bold ${amount > 0 ? 'text-success' : amount < 0 ? 'text-destructive' : ''}`}>
                          {amount > 0 ? `+$${amount}` : amount < 0 ? `-$${Math.abs(amount)}` : '-'}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
const Scorecard: React.FC = () => {
  const navigate = useNavigate();
  const { currentRound, roundTotals } = useApp();
  const [viewMode, setViewMode] = useState<'FRONT' | 'BACK'>('FRONT');

  if (!currentRound) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center space-y-6">
        <h2 className="text-xl font-bold">No Active Round</h2>
        <Button onClick={() => navigate('/')}>
          <Home className="w-5 h-5 mr-2" /> Go Home
        </Button>
      </div>
    );
  }

  const holePnL = calculateAggregatedHolePnL(currentRound);
  const holes = currentRound.course.holes;
  const front9 = holes.filter(h => h.number <= 9);
  const back9 = holes.filter(h => h.number > 9);
  const activeHoles = viewMode === 'FRONT' ? front9 : back9;

  const getPlayerScore = (pid: string, holeNum: number) => {
    const score = currentRound.scores[holeNum]?.[pid];
    return typeof score === 'number' ? score : '-';
  };

  const getPlayerHoleMoney = (pid: string, holeNum: number) => {
    return holePnL[holeNum]?.[pid] || 0;
  };

  // Find banker game and get banker for each hole
  const bankerGame = currentRound.games.find(g => g.type === GameType.BANKER);
  const getBankerForHole = (holeNum: number): string | null => {
    if (!bankerGame) return null;
    const holeData = currentRound.gameData?.[bankerGame.id]?.[holeNum];
    return holeData?.bankerId || null;
  };

  // Find FBO game and get dots data
  const fboGame = currentRound.games.find(g => g.type === GameType.FBO);
  const fboPlayerIds = fboGame?.config.fboPlayers || currentRound.players.map(p => p.id);
  const fboPlayers = currentRound.players.filter(p => fboPlayerIds.includes(p.id));
  
  // Find Stockton 6's game
  const stockton6Game = currentRound.games.find(g => g.type === GameType.STOCKTON_6);
  
  // Find Wolf game
  const wolfGame = currentRound.games.find(g => g.type === GameType.WOLF);
  
  // Find Nine Points game
  const ninePointsGame = currentRound.games.find(g => g.type === GameType.NINE_POINTS);
  
  // Find 6's game
  const sixesGame = currentRound.games.find(g => g.type === GameType.SIXES);
  
  // Wolf data helper
  const getWolfDataForHole = (holeNum: number): WolfHoleData | null => {
    if (!wolfGame) return null;
    const holeData = currentRound.gameData?.[wolfGame.id]?.[holeNum];
    return (holeData?.['_WOLF_DATA'] || holeData) as WolfHoleData | null;
  };
  const getDotsForHole = (holeNum: number): string[] => {
    if (!fboGame) return [];
    return currentRound.gameData?.[fboGame.id]?.[holeNum]?.dots || [];
  };

  const getTotalDotsForPlayer = (pid: string, holesToSum: typeof activeHoles): number => {
    if (!fboGame) return 0;
    let total = 0;
    holesToSum.forEach(h => {
      const dots = getDotsForHole(h.number);
      if (dots.includes(pid)) total++;
    });
    return total;
  };

  const getOverallDotsForPlayer = (pid: string): number => {
    if (!fboGame) return 0;
    let total = 0;
    holes.forEach(h => {
      const dots = getDotsForHole(h.number);
      if (dots.includes(pid)) total++;
    });
    return total;
  };

  // Stockton 6's dot helpers - use weighted dot counts
  const getStockton6DotCount = (playerId: string, holeNum: number): number => {
    if (!stockton6Game) return 0;
    return getWeightedDotCount(currentRound, stockton6Game.id, holeNum, playerId);
  };

  const getStockton6StretchDots = (playerId: string, stretch: 1 | 2 | 3): number => {
    if (!stockton6Game) return 0;
    const stretchHoles = STRETCH_HOLES[stretch];
    let total = 0;
    for (const h of stretchHoles) {
      total += getStockton6DotCount(playerId, h);
    }
    return total;
  };

  const getStockton6TotalDots = (playerId: string): number => {
    if (!stockton6Game) return 0;
    let total = 0;
    for (let h = 1; h <= 18; h++) {
      total += getStockton6DotCount(playerId, h);
    }
    return total;
  };

  // Get press indicators for a hole
  const getHolePresses = (holeNum: number): { oneBall: boolean; twoBall: boolean } => {
    if (!stockton6Game) return { oneBall: false, twoBall: false };
    const pressInfo = getHolePressInfo(currentRound, stockton6Game.id, holeNum);
    return {
      oneBall: pressInfo.oneBall.front || pressInfo.oneBall.back,
      twoBall: pressInfo.twoBall.front || pressInfo.twoBall.back
    };
  };

  // 6's hole result helper
  const getSixesHoleResultForHole = (holeNum: number): 'A' | 'B' | 'TIE' | null => {
    if (!sixesGame) return null;
    const stretch = getSixesStretchForHole(holeNum);
    const teamAssignment = getSixesTeamAssignment(currentRound.gameData, sixesGame.id, stretch);
    if (!teamAssignment) return null;
    
    return calculateSixesHoleResult(
      currentRound, 
      holeNum, 
      teamAssignment.teamA, 
      teamAssignment.teamB, 
      teamAssignment.useHandicaps, 
      teamAssignment.useSecondBallTiebreaker,
      teamAssignment.handicapMode
    );
  };

  // Get stretch result for 6's
  const getSixesStretchData = (stretch: 1 | 2 | 3) => {
    if (!sixesGame) return null;
    return calculateSixesStretchResult(currentRound, sixesGame, stretch);
  };


  const calculateSubtotalScore = (pid: string, holesToSum: typeof activeHoles) => {
    let total = 0;
    holesToSum.forEach(h => {
      const s = currentRound.scores[h.number]?.[pid];
      if (typeof s === 'number') total += s;
    });
    return total;
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="bg-brand-dark text-primary-foreground p-4 shadow-sm sticky top-0 z-10 flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-white/10 rounded-full">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-xl font-bold">Scorecard</h1>
        <div className="w-10" />
      </div>

      <div className="p-4 flex justify-center">
        <div className="bg-card p-1 rounded-xl shadow-sm border border-border flex gap-1">
          <button
            onClick={() => setViewMode('FRONT')}
            className={`px-6 py-2 rounded-lg text-sm font-bold transition-colors ${viewMode === 'FRONT' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
          >
            Front 9
          </button>
          <button
            onClick={() => setViewMode('BACK')}
            className={`px-6 py-2 rounded-lg text-sm font-bold transition-colors ${viewMode === 'BACK' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
          >
            Back 9
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto p-4">
        <div className="inline-block min-w-full bg-card rounded-xl shadow-sm border border-border overflow-hidden">
          <table className="w-full text-center border-collapse text-sm">
            <thead>
              <tr className="bg-muted text-xs font-bold text-muted-foreground uppercase">
                <th className="p-3 text-left min-w-[100px] sticky left-0 bg-muted border-r border-border z-10">Player</th>
                {activeHoles.map(h => (
                  <th 
                    key={h.number} 
                    className="p-2 min-w-[40px] border-r border-border/50 cursor-pointer hover:bg-primary/10 transition-colors"
                    onClick={() => navigate('/active', { state: { startHole: h.number } })}
                  >
                    {h.number}
                    <div className="text-[10px] text-muted-foreground font-normal mt-0.5">{h.par}</div>
                  </th>
                ))}
                <th className="p-2 min-w-[50px] bg-muted">Total</th>
              </tr>
            </thead>
            <tbody>
              {currentRound.players.map((player, idx) => (
                <React.Fragment key={player.id}>
                  <tr className={idx % 2 === 0 ? 'bg-card' : 'bg-muted/30'}>
                    <td className="p-3 text-left font-semibold sticky left-0 bg-inherit border-r border-border z-10">
                      {player.name}
                    </td>
                    {activeHoles.map(h => {
                      const score = getPlayerScore(player.id, h.number);
                      const diff = typeof score === 'number' ? score - h.par : 0;
                      // Check for manual stroke OR auto-calculated Stockton 6's stroke
                      let hasStroke = currentRound.gameData?.['MANUAL_STROKES']?.[h.number]?.[player.id] === 1;
                      if (!hasStroke && stockton6Game) {
                        const autoStrokes = calculateRelativeStrokes(currentRound.players, h.handicapIndex);
                        hasStroke = autoStrokes[player.id] === 1;
                      }
                      const isBanker = getBankerForHole(h.number) === player.id;
                      return (
                        <td key={h.number} className="p-2 border-r border-border/50">
                          <div className="relative inline-block">
                            <span className={`inline-block w-8 h-8 leading-8 rounded-full text-sm font-bold ${
                              diff <= -2 ? 'bg-brand-gold/20 text-brand-gold' :
                              diff === -1 ? 'bg-success/20 text-success' :
                              diff === 0 ? '' :
                              diff === 1 ? 'bg-destructive/10 text-destructive' :
                              'bg-destructive/20 text-destructive'
                            }`}>
                              {score}
                            </span>
                            {hasStroke && (
                              <span className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full border border-background flex items-center justify-center">
                                <span className="text-[8px] text-primary-foreground font-bold">•</span>
                              </span>
                            )}
                            {isBanker && (
                              <Crown className="absolute -bottom-1 -right-1 w-3 h-3 text-brand-gold" />
                            )}
                          </div>
                        </td>
                      );
                    })}
                    <td className="p-2 font-bold">{calculateSubtotalScore(player.id, activeHoles) || '-'}</td>
                  </tr>
                  <tr className={`text-xs ${idx % 2 === 0 ? 'bg-card' : 'bg-muted/30'}`}>
                    <td className="px-3 pb-2 text-left text-muted-foreground sticky left-0 bg-inherit border-r border-border z-10">P&L</td>
                    {activeHoles.map(h => {
                      const money = getPlayerHoleMoney(player.id, h.number);
                      return (
                        <td key={h.number} className="px-2 pb-2 border-r border-border/50">
                          <span className={`font-mono ${money > 0 ? 'text-success' : money < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                            {money !== 0 ? (money > 0 ? `+${money}` : money) : '-'}
                          </span>
                        </td>
                      );
                    })}
                    <td className="px-2 pb-2">
                      <span className={`font-mono font-bold ${(roundTotals[player.id] || 0) >= 0 ? 'text-success' : 'text-destructive'}`}>
                        ${roundTotals[player.id] || 0}
                      </span>
                    </td>
                  </tr>
                </React.Fragment>
              ))}
              {/* Press Row for Stockton 6's */}
              {stockton6Game && (
                <tr className="bg-amber-500/5 border-t border-amber-500/20">
                  <td className="p-3 text-left font-semibold sticky left-0 bg-amber-500/5 border-r border-border z-10 text-amber-600">
                    Press
                  </td>
                  {activeHoles.map(h => {
                    const presses = getHolePresses(h.number);
                    const hasPress = presses.oneBall || presses.twoBall;
                    
                    if (!hasPress) {
                      return (
                        <td key={h.number} className="p-2 border-r border-border/50">
                          <span className="text-muted-foreground/30">-</span>
                        </td>
                      );
                    }
                    
                    const labels: string[] = [];
                    if (presses.oneBall) labels.push('1B');
                    if (presses.twoBall) labels.push('2B');
                    
                    return (
                      <td key={h.number} className="p-2 border-r border-border/50">
                        <span className="text-xs font-bold text-amber-500">
                          {labels.join('/')}
                        </span>
                      </td>
                    );
                  })}
                  <td className="p-2 font-bold text-foreground">-</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* FBO Dots Section */}
        {fboGame && fboPlayers.length > 0 && (
          <>
            <div className="mt-4 inline-block min-w-full bg-card rounded-xl shadow-sm border border-primary/30 overflow-hidden">
              <div className="bg-primary/10 px-4 py-2 border-b border-primary/20">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🎱</span>
                  <h3 className="font-bold text-foreground">FBO Dots</h3>
                  <span className="text-xs text-muted-foreground ml-auto">${fboGame.unitStake} per segment</span>
                </div>
              </div>
              <table className="w-full text-center border-collapse text-sm">
                <thead>
                  <tr className="bg-muted text-xs font-bold text-muted-foreground uppercase">
                    <th className="p-3 text-left min-w-[100px] sticky left-0 bg-muted border-r border-border z-10">Player</th>
                    {activeHoles.map(h => (
                      <th key={h.number} className="p-2 min-w-[40px] border-r border-border/50">
                        {h.number}
                      </th>
                    ))}
                    <th className="p-2 min-w-[50px] bg-muted">{viewMode === 'FRONT' ? 'Front' : 'Back'}</th>
                    <th className="p-2 min-w-[50px] bg-primary/10">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {fboPlayers.map((player, idx) => (
                    <tr key={player.id} className={idx % 2 === 0 ? 'bg-card' : 'bg-muted/30'}>
                      <td className="p-3 text-left font-semibold sticky left-0 bg-inherit border-r border-border z-10">
                        {player.name}
                      </td>
                      {activeHoles.map(h => {
                        const dots = getDotsForHole(h.number);
                        const hasDot = dots.includes(player.id);
                        return (
                          <td key={h.number} className="p-2 border-r border-border/50">
                            {hasDot ? (
                              <span className="inline-flex items-center justify-center w-6 h-6 bg-primary text-primary-foreground rounded-full text-xs font-bold">
                                ●
                              </span>
                            ) : (
                              <span className="text-muted-foreground/30">-</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="p-2 font-bold text-foreground">
                        {getTotalDotsForPlayer(player.id, activeHoles)}
                      </td>
                      <td className="p-2 font-bold bg-primary/5">
                        <span className="text-primary">{getOverallDotsForPlayer(player.id)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* FBO Segment Results */}
            <FBOSegmentResults 
              fboGame={fboGame}
              fboPlayers={fboPlayers}
              scores={currentRound.scores}
              gameData={currentRound.gameData}
              courseHoles={holes}
            />
          </>
        )}

        {/* Stockton 6's Dots Section */}
        {stockton6Game && (
          <div className="mt-4 inline-block min-w-full bg-card rounded-xl shadow-sm border border-amber-500/30 overflow-hidden">
            <div className="bg-amber-500/10 px-4 py-2 border-b border-amber-500/20">
              <div className="flex items-center gap-2">
                <span className="text-lg">🎯</span>
                <h3 className="font-bold text-foreground">Stockton 6's Dots</h3>
                <span className="text-xs text-muted-foreground ml-auto">
                  ${stockton6Game.config?.stockton6?.dotValue || 2} per dot
                </span>
              </div>
            </div>
            <table className="w-full text-center border-collapse text-sm">
              <thead>
                <tr className="bg-muted text-xs font-bold text-muted-foreground uppercase">
                  <th className="p-3 text-left min-w-[100px] sticky left-0 bg-muted border-r border-border z-10">Player</th>
                  {activeHoles.map(h => (
                    <th key={h.number} className="p-2 min-w-[40px] border-r border-border/50">
                      {h.number}
                    </th>
                  ))}
                  <th className="p-2 min-w-[50px] bg-muted">
                    {viewMode === 'FRONT' ? 'S1' : 'S2/S3'}
                  </th>
                  <th className="p-2 min-w-[50px] bg-amber-500/10">Total</th>
                </tr>
              </thead>
              <tbody>
                {currentRound.players.map((player, idx) => (
                  <tr key={player.id} className={idx % 2 === 0 ? 'bg-card' : 'bg-muted/30'}>
                    <td className="p-3 text-left font-semibold sticky left-0 bg-inherit border-r border-border z-10">
                      {player.name}
                    </td>
                    {activeHoles.map(h => {
                      const dotCount = getStockton6DotCount(player.id, h.number);
                      return (
                        <td key={h.number} className="p-2 border-r border-border/50">
                          {dotCount > 0 ? (
                            <span className="inline-flex items-center justify-center w-6 h-6 bg-amber-500 text-white rounded-full text-xs font-bold">
                              {dotCount}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/30">-</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="p-2 font-bold text-foreground">
                      {viewMode === 'FRONT' 
                        ? getStockton6StretchDots(player.id, 1)
                        : getStockton6StretchDots(player.id, 2) + getStockton6StretchDots(player.id, 3)
                      }
                    </td>
                    <td className="p-2 font-bold bg-amber-500/5">
                      <span className="text-amber-600">{getStockton6TotalDots(player.id)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 6's Match Play Section */}
        {sixesGame && (
          <div className="mt-4 inline-block min-w-full bg-card rounded-xl shadow-sm border border-primary/30 overflow-hidden">
            <div className="bg-primary/10 px-4 py-2 border-b border-primary/20">
              <div className="flex items-center gap-2">
                <span className="text-lg">⚔️</span>
                <h3 className="font-bold text-foreground">6's Match Play</h3>
                <span className="text-xs text-muted-foreground ml-auto">
                  ${sixesGame.unitStake} per stretch
                </span>
              </div>
            </div>
            <table className="w-full text-center border-collapse text-sm">
              <thead>
                <tr className="bg-muted text-xs font-bold text-muted-foreground uppercase">
                  <th className="p-3 text-left min-w-[100px] sticky left-0 bg-muted border-r border-border z-10">Team</th>
                  {activeHoles.map(h => (
                    <th key={h.number} className="p-2 min-w-[40px] border-r border-border/50">
                      {h.number}
                    </th>
                  ))}
                  <th className="p-2 min-w-[80px] bg-muted">Match</th>
                </tr>
              </thead>
              <tbody>
                {/* Team A Row - shows team members with hole winner highlighting */}
                <tr className="bg-primary/5">
                  <td className="p-3 text-left font-semibold sticky left-0 bg-primary/5 border-r border-border z-10 text-primary">
                    Team A
                  </td>
                  {activeHoles.map(h => {
                    const stretch = getSixesStretchForHole(h.number);
                    const assignment = getSixesTeamAssignment(currentRound.gameData, sixesGame.id, stretch);
                    const result = getSixesHoleResultForHole(h.number);
                    const isWinner = result === 'A';
                    const isTie = result === 'TIE';
                    
                    if (!assignment) return <td key={h.number} className="p-2 border-r border-border/50">-</td>;
                    
                    const teamANames = assignment.teamA
                      .map(pid => currentRound.players.find(p => p.id === pid)?.name?.charAt(0) || '?')
                      .join('/');
                    
                    return (
                      <td key={h.number} className="p-2 border-r border-border/50">
                        {isWinner ? (
                          <span className="inline-flex items-center justify-center px-1.5 py-0.5 bg-primary/20 border-2 border-primary rounded-md text-xs font-bold text-primary">
                            {teamANames}
                          </span>
                        ) : isTie ? (
                          <span className="text-xs text-muted-foreground">{teamANames}</span>
                        ) : result === 'B' ? (
                          <span className="text-xs text-primary/40">{teamANames}</span>
                        ) : (
                          <span className="text-xs text-primary">{teamANames}</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="p-2 border-l border-border" rowSpan={2}>
                    {(() => {
                      const stretch = viewMode === 'FRONT' ? 1 : 2;
                      const result = getSixesStretchData(stretch);
                      if (!result) return <span className="text-muted-foreground">-</span>;
                      
                      const { teamAWins, teamBWins } = result;
                      const winnerTeam = teamAWins > teamBWins ? 'A' : teamBWins > teamAWins ? 'B' : 'PUSH';
                      
                      return (
                        <div className="flex flex-col items-center gap-1">
                          {winnerTeam === 'A' && (
                            <>
                              <Trophy className="w-5 h-5 text-primary" />
                              <span className="text-xs font-bold text-primary">Team A</span>
                            </>
                          )}
                          {winnerTeam === 'B' && (
                            <>
                              <Trophy className="w-5 h-5 text-destructive" />
                              <span className="text-xs font-bold text-destructive">Team B</span>
                            </>
                          )}
                          {winnerTeam === 'PUSH' && (
                            <span className="text-xs font-medium text-muted-foreground">Push</span>
                          )}
                          <span className="text-lg font-bold">{teamAWins}-{teamBWins}</span>
                        </div>
                      );
                    })()}
                  </td>
                </tr>
                
                {/* Team B Row - shows team members with hole winner highlighting */}
                <tr className="bg-destructive/5">
                  <td className="p-3 text-left font-semibold sticky left-0 bg-destructive/5 border-r border-border z-10 text-destructive">
                    Team B
                  </td>
                  {activeHoles.map(h => {
                    const stretch = getSixesStretchForHole(h.number);
                    const assignment = getSixesTeamAssignment(currentRound.gameData, sixesGame.id, stretch);
                    const result = getSixesHoleResultForHole(h.number);
                    const isWinner = result === 'B';
                    const isTie = result === 'TIE';
                    
                    if (!assignment) return <td key={h.number} className="p-2 border-r border-border/50">-</td>;
                    
                    const teamBNames = assignment.teamB
                      .map(pid => currentRound.players.find(p => p.id === pid)?.name?.charAt(0) || '?')
                      .join('/');
                    
                    return (
                      <td key={h.number} className="p-2 border-r border-border/50">
                        {isWinner ? (
                          <span className="inline-flex items-center justify-center px-1.5 py-0.5 bg-destructive/20 border-2 border-destructive rounded-md text-xs font-bold text-destructive">
                            {teamBNames}
                          </span>
                        ) : isTie ? (
                          <span className="text-xs text-muted-foreground">{teamBNames}</span>
                        ) : result === 'A' ? (
                          <span className="text-xs text-destructive/40">{teamBNames}</span>
                        ) : (
                          <span className="text-xs text-destructive">{teamBNames}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="p-4 bg-card border-t border-border">
        <Button onClick={() => {
          // Find the last hole with any score posted
          const holesWithScores = Object.keys(currentRound.scores)
            .map(Number)
            .filter(h => Object.values(currentRound.scores[h] || {}).some(s => typeof s === 'number'));
          const lastHole = holesWithScores.length > 0 ? Math.max(...holesWithScores) : 1;
          navigate('/active', { state: { startHole: lastHole } });
        }} className="w-full">
          <Play className="w-4 h-4 mr-2" /> Return to Hole
        </Button>
      </div>
    </div>
  );
};

export default Scorecard;
