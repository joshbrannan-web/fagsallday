import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import { ArrowLeft, Home, Play, Crown, Trophy, TrendingDown, Minus, AlertTriangle, Share2, Flag } from 'lucide-react';
import { calculateAggregatedHolePnL, calculateBanker, calculateFBO } from '../services/gameEngine';
import { calculateTeamBanker } from '../services/teamBankerEngine';
import { calculateRelativeStrokes, getWeightedDotCount, STRETCH_HOLES, getHolePressInfo, calculateStockton6 } from '../services/stockton6Engine';
import { getSixesTeamAssignment, calculateSixesHoleResult, calculateSixesStretchResult, getSixesStretchForHole, getSixesPresses, getSixesMode, SixesMode } from '../services/sixesEngine';
import { SixesMatchSummary } from './sixes';
import { Button } from '@/components/ui/button';
import GameRoundTotals from './GameRoundTotals';
import ScorecardImage, { ScorecardImageHandle } from './ScorecardImage';
import { GameType, GameSettings, Player, HoleScores, GameData, Hole, WolfHoleData, FBOPressState, SixesPressState } from '../types';
import { toast } from 'sonner';

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
    holeDots.forEach((playerId: string | number) => {
      const normalizedId = String(playerId);
      if (dotCounts.overall[normalizedId] !== undefined) {
        dotCounts.overall[normalizedId]++;
        if (h <= 9) dotCounts.front[normalizedId]++;
        else dotCounts.back[normalizedId]++;
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
        
        {/* FBO Presses Section */}
        {(() => {
          // Fix: Read presses from hole 1 where they are stored by ActiveRound
          const fboGameData = gameData?.[fboGame.id] || {};
          const presses: FBOPressState[] = (fboGameData as any)[1]?._META_PRESSES || [];
          
          if (presses.length === 0) return null;
          
          return (
            <div className="border-t border-border pt-3 mt-3">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span className="font-semibold text-sm">Presses</span>
              </div>
              <div className="space-y-2">
              {presses.map((press, idx) => {
                  const player = fboPlayers.find(p => p.id === String(press.playerId));
                  const segmentEnd = press.segment === 'front' ? 9 : 18;
                  const isComplete = press.segment === 'front' ? frontNineComplete : 
                                     press.segment === 'back' ? backNineComplete :
                                     overallComplete; // Overall requires full round
                  
                  const segmentLabel = press.segment === 'front' ? 'Front' : 
                                       press.segment === 'back' ? 'Back' : 
                                       'Overall';
                  
                  // Calculate press dots if complete
                  let pressResult: { winner: string | null; amount: number } | null = null;
                  if (isComplete) {
                    const pressDots: { [id: string]: number } = {};
                    fboPlayers.forEach(p => pressDots[p.id] = 0);
                    
                    for (let h = press.startHole; h <= segmentEnd; h++) {
                      const holeDots = fboData[h]?.dots || [];
                      holeDots.forEach((playerId: string | number) => {
                        const normalizedId = String(playerId);
                        if (pressDots[normalizedId] !== undefined) {
                          pressDots[normalizedId]++;
                        }
                      });
                    }
                    
                    const maxDots = Math.max(...Object.values(pressDots));
                    const winners = Object.entries(pressDots).filter(([_, dots]) => dots === maxDots);
                    
                    if (winners.length === 1 && maxDots > 0) {
                      pressResult = { 
                        winner: winners[0][0], 
                        amount: press.unitValue * (fboPlayers.length - 1)
                      };
                    } else {
                      pressResult = { winner: null, amount: 0 }; // Push
                    }
                  }
                  
                  const winnerPlayer = pressResult?.winner ? fboPlayers.find(p => p.id === pressResult!.winner) : null;
                  const presserWon = pressResult?.winner === press.playerId;
                  
                  return (
                    <div 
                      key={idx} 
                      className={`flex items-center justify-between px-3 py-2 rounded-md text-sm ${
                        !isComplete ? 'bg-amber-500/10 border border-amber-500/20' :
                        pressResult?.winner === null ? 'bg-muted/50' :
                        presserWon ? 'bg-success/10 border border-success/20' :
                        'bg-destructive/10 border border-destructive/20'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span>{player?.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {(press as any).pressLevel === 2 ? 'double pressed' : 
                           (press as any).pressLevel > 2 ? `${(press as any).pressLevel}x pressed` : 
                           'pressed'} {segmentLabel} on #{press.startHole}
                        </span>
                      </div>
                      <div>
                        {!isComplete ? (
                          <span className="text-xs text-amber-500 font-medium">In Progress</span>
                        ) : pressResult?.winner === null ? (
                          <span className="text-xs text-muted-foreground font-medium">Push</span>
                        ) : (
                          <span className={`font-mono font-bold ${presserWon ? 'text-success' : 'text-destructive'}`}>
                            {presserWon ? `+$${pressResult.amount}` : `-$${press.unitValue}`}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
};

// FBO Matchup Results Component (for Head-to-Head mode)
interface FBOMatchupResultsProps {
  fboGame: GameSettings;
  fboPlayers: Player[];
  scores: { [holeNumber: number]: HoleScores };
  gameData: GameData;
  courseHoles: Hole[];
  viewMode: 'FRONT' | 'BACK';
}

const FBOMatchupResults: React.FC<FBOMatchupResultsProps> = ({
  fboGame,
  fboPlayers,
  scores,
  gameData,
  courseHoles,
  viewMode,
}) => {
  const matchups = fboGame.config.fbo?.headToHeadMatchups || [];
  const fboData = gameData?.[fboGame.id] || {};
  const presses: FBOPressState[] = (fboData as any)[1]?._META_PRESSES || [];

  const front9 = courseHoles.filter(h => h.number <= 9);
  const back9 = courseHoles.filter(h => h.number > 9);
  const activeHoles = viewMode === 'FRONT' ? front9 : back9;

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

  // Get dot winner for a specific matchup on a specific hole
  const getMatchupDotForHole = (p1Id: string, p2Id: string, holeNum: number): string | null => {
    const matchupDotsData = fboData[holeNum]?.matchupDots || {};
    // Try both key orderings
    const key1 = `${String(p1Id)}_${String(p2Id)}`;
    const key2 = `${String(p2Id)}_${String(p1Id)}`;
    const winner = matchupDotsData[key1] ?? matchupDotsData[key2];
    return winner ? String(winner) : null;
  };

  // Count dots for a player in a SPECIFIC matchup (uses matchupDots for H2H mode)
  const countDotsForMatchup = (
    p1Id: string,
    p2Id: string,
    startHole: number,
    endHole: number
  ): { p1Dots: number; p2Dots: number } => {
    let p1Dots = 0;
    let p2Dots = 0;
    
    for (let h = startHole; h <= endHole; h++) {
      const winner = getMatchupDotForHole(p1Id, p2Id, h);
      if (String(winner) === String(p1Id)) p1Dots++;
      if (String(winner) === String(p2Id)) p2Dots++;
    }
    
    return { p1Dots, p2Dots };
  };

  // Get presses for a specific matchup
  const getPressesForMatchup = (p1Id: string, p2Id: string): FBOPressState[] => {
    return presses.filter(p => 
      (String(p.playerId) === String(p1Id) && String(p.opponentId) === String(p2Id)) ||
      (String(p.playerId) === String(p2Id) && String(p.opponentId) === String(p1Id))
    );
  };

  // Aggregate totals across all matchups
  const aggregatedTotals: { [playerId: string]: number } = {};
  fboPlayers.forEach(p => aggregatedTotals[p.id] = 0);

  return (
    <div className="mt-4 space-y-6">
      {matchups.map((matchup, idx) => {
        const player1 = fboPlayers.find(p => String(p.id) === String(matchup.player1Id));
        const player2 = fboPlayers.find(p => String(p.id) === String(matchup.player2Id));
        if (!player1 || !player2) return null;

        const matchupPresses = getPressesForMatchup(matchup.player1Id, matchup.player2Id);

        // Calculate dots per segment using per-matchup data
        const { p1Dots: p1FrontDots, p2Dots: p2FrontDots } = countDotsForMatchup(
          matchup.player1Id, matchup.player2Id, 1, 9
        );
        const { p1Dots: p1BackDots, p2Dots: p2BackDots } = countDotsForMatchup(
          matchup.player1Id, matchup.player2Id, 10, 18
        );
        const p1OverallDots = p1FrontDots + p1BackDots;
        const p2OverallDots = p2FrontDots + p2BackDots;

        // Calculate segment results
        const calculateSegmentResult = (p1Dots: number, p2Dots: number, isComplete: boolean) => {
          if (!isComplete) return { winner: null, p1Amount: 0, p2Amount: 0, status: 'pending' as const };
          if (p1Dots > p2Dots) {
            return { winner: matchup.player1Id, p1Amount: matchup.unitValue, p2Amount: -matchup.unitValue, status: 'settled' as const };
          } else if (p2Dots > p1Dots) {
            return { winner: matchup.player2Id, p1Amount: -matchup.unitValue, p2Amount: matchup.unitValue, status: 'settled' as const };
          }
          return { winner: null, p1Amount: 0, p2Amount: 0, status: 'push' as const };
        };

        const frontResult = calculateSegmentResult(p1FrontDots, p2FrontDots, frontNineComplete);
        const backResult = calculateSegmentResult(p1BackDots, p2BackDots, backNineComplete);
        const overallResult = calculateSegmentResult(p1OverallDots, p2OverallDots, overallComplete);

        // Calculate matchup total (segments only - presses tracked separately)
        const p1SegmentTotal = frontResult.p1Amount + backResult.p1Amount + overallResult.p1Amount;
        const p2SegmentTotal = frontResult.p2Amount + backResult.p2Amount + overallResult.p2Amount;

        // Calculate press results for this matchup
        let p1PressTotal = 0;
        let p2PressTotal = 0;
        const pressResults = matchupPresses.map(press => {
          const pressEnd = press.segment === 'front' ? 9 : 18;
          const isComplete = press.segment === 'front' ? frontNineComplete :
                            press.segment === 'back' ? backNineComplete :
                            overallComplete;
          
          if (!isComplete) {
            return { press, result: null, isComplete: false };
          }

          // Use matchupDots for H2H mode press calculations
          let presserDots = 0;
          let opponentDots = 0;
          for (let h = press.startHole; h <= pressEnd; h++) {
            const winner = getMatchupDotForHole(matchup.player1Id, matchup.player2Id, h);
            if (String(winner) === String(press.playerId)) presserDots++;
            if (String(winner) === String(press.opponentId)) opponentDots++;
          }

          if (presserDots > opponentDots) {
            if (String(press.playerId) === String(matchup.player1Id)) {
              p1PressTotal += press.unitValue;
              p2PressTotal -= press.unitValue;
            } else {
              p2PressTotal += press.unitValue;
              p1PressTotal -= press.unitValue;
            }
            return { press, result: 'won' as const, presserDots, opponentDots, isComplete: true };
          } else if (opponentDots > presserDots) {
            if (String(press.playerId) === String(matchup.player1Id)) {
              p1PressTotal -= press.unitValue;
              p2PressTotal += press.unitValue;
            } else {
              p2PressTotal -= press.unitValue;
              p1PressTotal += press.unitValue;
            }
            return { press, result: 'lost' as const, presserDots, opponentDots, isComplete: true };
          }
          return { press, result: 'push' as const, presserDots, opponentDots, isComplete: true };
        });

        const p1Total = p1SegmentTotal + p1PressTotal;
        const p2Total = p2SegmentTotal + p2PressTotal;

        // Update aggregated totals
        aggregatedTotals[matchup.player1Id] += p1Total;
        aggregatedTotals[matchup.player2Id] += p2Total;

        // Calculate current 9 dots for subtotal column
        const p1SubtotalDots = viewMode === 'FRONT' ? p1FrontDots : p1BackDots;
        const p2SubtotalDots = viewMode === 'FRONT' ? p2FrontDots : p2BackDots;

        return (
          <div key={idx} className="inline-block min-w-full bg-card rounded-xl shadow-sm border border-primary/30 overflow-hidden">
            {/* Matchup Header */}
            <div className="bg-primary/10 px-4 py-2 border-b border-primary/20">
              <div className="flex items-center gap-2">
                <span className="text-lg">🎱</span>
                <h3 className="font-bold text-foreground">{player1.name} vs {player2.name}</h3>
                <span className="text-xs text-muted-foreground ml-auto">${matchup.unitValue} per segment</span>
              </div>
            </div>

            {/* Dots Table - Per Hole */}
            <table className="w-full text-center border-collapse text-sm">
              <thead>
                <tr className="bg-muted text-xs font-bold text-muted-foreground uppercase">
                  <th className="p-3 text-left min-w-[100px] sticky left-0 bg-muted border-r border-border z-10">Player</th>
                  {activeHoles.map(h => (
                    <th key={h.number} className="p-2 min-w-[40px] border-r border-border/50">
                      {h.number}
                    </th>
                  ))}
                  <th className="p-2 min-w-[50px] bg-muted">{viewMode === 'FRONT' ? 'F9' : 'B9'}</th>
                  <th className="p-2 min-w-[50px] bg-primary/10">Total</th>
                </tr>
              </thead>
              <tbody>
                {/* Player 1 Row */}
                <tr className="bg-card">
                  <td className="p-3 text-left font-semibold sticky left-0 bg-inherit border-r border-border z-10">
                    <div className="flex items-center gap-2">
                      {(frontResult.winner === matchup.player1Id || backResult.winner === matchup.player1Id || overallResult.winner === matchup.player1Id) && (
                        <Trophy className="w-4 h-4 text-brand-gold" />
                      )}
                      {player1.name}
                    </div>
                  </td>
                  {activeHoles.map(h => {
                    const winner = getMatchupDotForHole(matchup.player1Id, matchup.player2Id, h.number);
                    const hasDot = String(winner) === String(matchup.player1Id);
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
                  <td className="p-2 font-bold text-foreground">{p1SubtotalDots}</td>
                  <td className="p-2 font-bold bg-primary/5">
                    <span className="text-primary">{p1OverallDots}</span>
                  </td>
                </tr>

                {/* Player 2 Row */}
                <tr className="bg-muted/30">
                  <td className="p-3 text-left font-semibold sticky left-0 bg-inherit border-r border-border z-10">
                    <div className="flex items-center gap-2">
                      {(frontResult.winner === matchup.player2Id || backResult.winner === matchup.player2Id || overallResult.winner === matchup.player2Id) && (
                        <Trophy className="w-4 h-4 text-brand-gold" />
                      )}
                      {player2.name}
                    </div>
                  </td>
                  {activeHoles.map(h => {
                    const winner = getMatchupDotForHole(matchup.player1Id, matchup.player2Id, h.number);
                    const hasDot = String(winner) === String(matchup.player2Id);
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
                  <td className="p-2 font-bold text-foreground">{p2SubtotalDots}</td>
                  <td className="p-2 font-bold bg-primary/5">
                    <span className="text-primary">{p2OverallDots}</span>
                  </td>
                </tr>

                {/* Results Row */}
                <tr className="bg-muted/50 border-t border-border">
                  <td className="p-2 text-left font-semibold text-xs text-muted-foreground sticky left-0 bg-muted/50 border-r border-border z-10">
                    Result
                  </td>
                  <td colSpan={activeHoles.length} className="p-2 text-center">
                    <div className="flex items-center justify-center gap-4 text-xs flex-wrap">
                      <span className={frontResult.status === 'settled' && frontResult.winner ? 'font-semibold' : ''}>
                        F9: {!frontNineComplete ? 'In Progress' : 
                             frontResult.status === 'push' ? 'Push' :
                             `${fboPlayers.find(p => String(p.id) === String(frontResult.winner))?.name} +$${matchup.unitValue}`}
                      </span>
                      <span className={backResult.status === 'settled' && backResult.winner ? 'font-semibold' : ''}>
                        B9: {!backNineComplete ? 'In Progress' : 
                             backResult.status === 'push' ? 'Push' :
                             `${fboPlayers.find(p => String(p.id) === String(backResult.winner))?.name} +$${matchup.unitValue}`}
                      </span>
                      <span className={overallResult.status === 'settled' && overallResult.winner ? 'font-semibold' : ''}>
                        Overall: {!overallComplete ? 'In Progress' : 
                                  overallResult.status === 'push' ? 'Push' :
                                  `${fboPlayers.find(p => String(p.id) === String(overallResult.winner))?.name} +$${matchup.unitValue}`}
                      </span>
                    </div>
                  </td>
                  <td className="p-2 font-bold text-foreground"></td>
                  <td className="p-2 font-bold bg-primary/5">
                    <div className="flex flex-col text-xs">
                      <span className={`font-mono ${p1Total > 0 ? 'text-success' : p1Total < 0 ? 'text-destructive' : ''}`}>
                        {player1.name.charAt(0)}: {p1Total > 0 ? `+$${p1Total}` : p1Total < 0 ? `-$${Math.abs(p1Total)}` : '$0'}
                      </span>
                      <span className={`font-mono ${p2Total > 0 ? 'text-success' : p2Total < 0 ? 'text-destructive' : ''}`}>
                        {player2.name.charAt(0)}: {p2Total > 0 ? `+$${p2Total}` : p2Total < 0 ? `-$${Math.abs(p2Total)}` : '$0'}
                      </span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Presses Section */}
            {matchupPresses.length > 0 && (
              <div className="border-t border-border p-4">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-4 h-4 text-warning" />
                  <span className="font-semibold text-sm">Presses</span>
                </div>
                <div className="space-y-2">
                  {pressResults.map((pr, pIdx) => {
                    const pressingPlayer = fboPlayers.find(p => p.id === String(pr.press.playerId));
                    const opponent = fboPlayers.find(p => p.id === String(pr.press.opponentId));
                    const segmentLabel = pr.press.segment === 'front' ? 'Front 9' : 
                                         pr.press.segment === 'back' ? 'Back 9' : 'Overall';
                    const pressLevelLabel = (pr.press.pressLevel || 1) > 1 ? ` (${pr.press.pressLevel}x)` : '';

                    return (
                      <div 
                        key={pIdx} 
                        className={`flex items-center justify-between px-3 py-2 rounded-md text-sm ${
                          !pr.isComplete ? 'bg-warning/10 border border-warning/20' :
                          pr.result === 'push' ? 'bg-muted/50' :
                          pr.result === 'won' ? 'bg-success/10 border border-success/20' :
                          'bg-destructive/10 border border-destructive/20'
                        }`}
                      >
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{pressingPlayer?.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {pressLevelLabel ? `${pressLevelLabel.trim()} ` : ''}pressed {segmentLabel} on #{pr.press.startHole}
                            </span>
                          </div>
                          {pr.isComplete && pr.presserDots !== undefined && (
                            <span className="text-xs text-muted-foreground mt-0.5">
                              {pressingPlayer?.name?.charAt(0)}: {pr.presserDots} dots | {opponent?.name?.charAt(0)}: {pr.opponentDots} dots
                            </span>
                          )}
                        </div>
                        <div>
                          {!pr.isComplete ? (
                            <span className="text-xs text-warning font-medium">In Progress</span>
                          ) : pr.result === 'push' ? (
                            <span className="text-xs text-muted-foreground font-medium">Push</span>
                          ) : (
                            <span className={`font-mono font-bold ${pr.result === 'won' ? 'text-success' : 'text-destructive'}`}>
                              {pr.result === 'won' ? `+$${pr.press.unitValue}` : `-$${pr.press.unitValue}`}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Aggregated Summary */}
      {matchups.length > 1 && (
        <div className="bg-card rounded-xl shadow-sm border border-primary/30 overflow-hidden">
          <div className="bg-primary/10 px-4 py-3 border-b border-primary/20">
            <span className="font-bold text-foreground">Overall Summary</span>
          </div>
          <div className="p-4">
            <div className="grid gap-2">
              {fboPlayers.map(player => {
                const total = aggregatedTotals[player.id] || 0;
                return (
                  <div key={player.id} className="flex items-center justify-between px-3 py-2 rounded-md bg-muted/30">
                    <span className="font-medium">{player.name}</span>
                    <span className={`font-mono font-bold ${total > 0 ? 'text-success' : total < 0 ? 'text-destructive' : ''}`}>
                      {total > 0 ? `+$${total}` : total < 0 ? `-$${Math.abs(total)}` : '$0'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const Scorecard: React.FC = () => {
  const navigate = useNavigate();
  const { currentRound, roundTotals } = useApp();
  const [viewMode, setViewMode] = useState<'FRONT' | 'BACK'>('FRONT');
  const scorecardImageRef = useRef<ScorecardImageHandle>(null);

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

  // Find banker games (both regular Banker and Bloody Banker) and get banker for each hole
  const bankerGames = currentRound.games.filter(g => 
    g.type === GameType.BANKER || g.type === GameType.BLOODY_BANKER
  );
  const getBankerForHole = (holeNum: number): string | null => {
    for (const game of bankerGames) {
      const holeData = currentRound.gameData?.[game.id]?.[holeNum];
      // Check both _META_BANKER_ID (stored format) and bankerId (legacy format)
      const bankerId = holeData?._META_BANKER_ID || holeData?.bankerId;
      if (bankerId) return bankerId;
    }
    return null;
  };

  // Find FBO game and get dots data (normalize IDs to strings)
  const fboGame = currentRound.games.find(g => g.type === GameType.FBO);
  const fboPlayerIds = (fboGame?.config.fboPlayers || currentRound.players.map(p => p.id)).map(id => String(id));
  const fboPlayers = currentRound.players.filter(p => fboPlayerIds.includes(String(p.id)));
  
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
    const mode = getSixesMode(currentRound.gameData, sixesGame.id);
    const stretch = getSixesStretchForHole(holeNum, mode);
    const teamAssignment = getSixesTeamAssignment(currentRound.gameData, sixesGame.id, stretch, mode);
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
  const getSixesStretchData = (stretch: 1 | 2 | 3 | 4 | 5 | 6) => {
    if (!sixesGame) return null;
    const mode = getSixesMode(currentRound.gameData, sixesGame.id);
    return calculateSixesStretchResult(currentRound, sixesGame, stretch, mode);
  };


  const calculateSubtotalScore = (pid: string, holesToSum: typeof activeHoles) => {
    let total = 0;
    holesToSum.forEach(h => {
      const s = currentRound.scores[h.number]?.[pid];
      if (typeof s === 'number') total += s;
    });
    return total;
  };

  // Calculate full 18-hole total score for image capture
  const calculateTotalScore = (pid: string) => {
    let total = 0;
    holes.forEach(h => {
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
        {/* Main Player Scorecard */}
        <div className="inline-block min-w-full bg-card rounded-xl shadow-sm border border-border overflow-hidden">
          {/* Header for image capture */}
          <div className="bg-muted/50 px-4 py-3 border-b border-border">
            <div className="text-center">
              <h3 className="font-bold text-foreground text-lg">{currentRound.course.name}</h3>
              <p className="text-xs text-muted-foreground">
                {new Date(currentRound.startTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
          </div>
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
                    <div className="text-[10px] text-muted-foreground font-normal mt-0.5">par {h.par}</div>
                    <div className="text-[10px] text-muted-foreground font-normal">IDX {h.handicapIndex}</div>
                  </th>
                ))}
                <th className="p-2 min-w-[50px] bg-muted">
                  {viewMode === 'FRONT' ? 'F9' : 'B9'}
                  <div className="text-[10px] text-muted-foreground font-normal mt-0.5">
                    par {viewMode === 'FRONT'
                      ? currentRound.course.holes.filter(h => h.number <= 9).reduce((sum, h) => sum + h.par, 0)
                      : currentRound.course.holes.filter(h => h.number > 9).reduce((sum, h) => sum + h.par, 0)}
                  </div>
                </th>
                <th className="p-2 min-w-[50px] bg-muted border-l border-border">
                  18
                  <div className="text-[10px] text-muted-foreground font-normal mt-0.5">
                    par {currentRound.course.holes.reduce((sum, h) => sum + h.par, 0)}
                  </div>
                </th>
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
                      // Determine shape: circle for birdies/eagles, square for bogeys+
                      const isUnderPar = diff < 0;
                      const isOverPar = diff > 0;
                      const isDblBogeyPlus = diff >= 2;
                      const shapeClass = isUnderPar ? 'rounded-full' : isOverPar ? 'rounded-lg' : '';
                      
                      return (
                        <td key={h.number} className="p-2 border-r border-border/50">
                          <div className="relative inline-block">
                            <span className={`inline-block w-8 h-8 leading-8 ${shapeClass} text-sm font-bold ${
                              diff <= -2 ? 'bg-brand-gold/20 text-brand-gold' :
                              diff === -1 ? 'bg-success/20 text-success' :
                              diff === 0 ? '' :
                              isDblBogeyPlus ? 'border-2 border-foreground ring-2 ring-foreground ring-offset-1 text-destructive' :
                              diff === 1 ? 'border-2 border-foreground text-destructive' :
                              ''
                            }`}>
                              {score}
                            </span>
                            {hasStroke && (
                              <span className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full border border-background flex items-center justify-center">
                                <span className="text-[8px] text-primary-foreground font-bold">•</span>
                              </span>
                            )}
                            {isBanker && (
                              <Crown className="absolute -top-1 -right-1 w-3 h-3 text-brand-gold" />
                            )}
                          </div>
                        </td>
                      );
                    })}
                    <td className="p-2 font-bold">{calculateSubtotalScore(player.id, activeHoles) || '-'}</td>
                    <td className="p-2 font-bold border-l border-border">{calculateTotalScore(player.id) || '-'}</td>
                  </tr>
                  <tr className={`text-xs ${idx % 2 === 0 ? 'bg-card' : 'bg-muted/30'}`}>
                    <td className="px-3 pb-2 text-left text-muted-foreground sticky left-0 bg-inherit border-r border-border z-10">HCP {player.courseHandicap}</td>
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
                    <td className="px-2 pb-2 border-l border-border"></td>
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
                  <td className="p-2 border-l border-border">-</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Banker/Bloody Banker Round Totals - placed under main scorecard */}
        {currentRound.games
          .filter(g => g.type === GameType.BANKER || g.type === GameType.BLOODY_BANKER)
          .map(game => {
            const result = calculateBanker(currentRound, game);
            return (
              <GameRoundTotals
                key={game.id}
                gameName={game.name || (game.type === GameType.BLOODY_BANKER ? 'Bloody Banker' : 'Banker')}
                playerResults={result.playerResults}
                players={currentRound.players}
                icon={<Crown className="w-5 h-5 text-brand-gold" />}
                accentColor="brand-gold"
              />
            );
          })}

        {/* FBO Section */}
        {fboGame && fboPlayers.length > 0 && (
          <>
            {/* FBO Dots Table - Only show for "All Together" mode, not Head-to-Head */}
            {!(fboGame.config.fbo?.gameMode === 'headToHead' && 
               fboGame.config.fbo?.headToHeadMatchups?.length > 0) && (
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
                    {/* FBO Press Indicator Row */}
                    {(() => {
                      const fboGameDataForPresses = currentRound.gameData?.[fboGame.id] || {};
                      const fboPresses: FBOPressState[] = (fboGameDataForPresses as any)[1]?._META_PRESSES || [];
                      
                      if (fboPresses.length === 0) return null;
                      
                      return (
                        <tr className="bg-warning/5 border-t border-warning/20">
                          <td className="p-3 text-left font-semibold sticky left-0 bg-warning/5 border-r border-border z-10 text-warning">
                            <div className="flex items-center gap-1">
                              <AlertTriangle className="w-4 h-4" />
                              Press
                            </div>
                          </td>
                          {activeHoles.map(h => {
                            const pressesOnHole = fboPresses.filter(p => p.startHole === h.number);
                            if (pressesOnHole.length === 0) {
                              return <td key={h.number} className="p-2 border-r border-border/50 text-muted-foreground/30">-</td>;
                            }
                            
                            return (
                              <td key={h.number} className="p-2 border-r border-border/50">
                                <div className="flex flex-wrap gap-0.5 justify-center">
                                  {pressesOnHole.map((press, pIdx) => {
                                    const player = fboPlayers.find(p => p.id === String(press.playerId));
                                    const segmentIndicator = press.segment === 'front' ? 'F' : 
                                                             press.segment === 'back' ? 'B' : 
                                                             'O';
                                    return (
                                      <span 
                                        key={pIdx}
                                        className={`inline-flex items-center justify-center min-w-[1.25rem] h-5 px-0.5 rounded text-[10px] font-bold ${
                                          press.segment === 'overall' ? 'bg-primary text-primary-foreground' : 'bg-warning text-warning-foreground'
                                        }`}
                                      >
                                        {player?.name?.charAt(0) || 'P'}{segmentIndicator}
                                      </span>
                                    );
                                  })}
                                </div>
                              </td>
                            );
                          })}
                          <td className="p-2 font-bold text-muted-foreground/30">-</td>
                          <td className="p-2 font-bold bg-primary/5 text-muted-foreground/30">-</td>
                        </tr>
                      );
                    })()}
                  </tbody>
                </table>
              </div>
            )}

            {/* FBO Segment Results - Switch based on game mode */}
            {fboGame.config.fbo?.gameMode === 'headToHead' && 
             fboGame.config.fbo?.headToHeadMatchups && 
             fboGame.config.fbo.headToHeadMatchups.length > 0 ? (
              <FBOMatchupResults 
                fboGame={fboGame}
                fboPlayers={fboPlayers}
                scores={currentRound.scores}
                gameData={currentRound.gameData}
                courseHoles={holes}
                viewMode={viewMode}
              />
            ) : (
              <FBOSegmentResults 
                fboGame={fboGame}
                fboPlayers={fboPlayers}
                scores={currentRound.scores}
                gameData={currentRound.gameData}
                courseHoles={holes}
              />
            )}

            {/* FBO Round Totals */}
            <GameRoundTotals
              gameName="FBO"
              playerResults={calculateFBO(currentRound, fboGame).playerResults}
              players={fboPlayers}
              icon={<span className="text-lg">🎱</span>}
              accentColor="primary"
            />
          </>
        )}

        {/* Stockton 6's Dots Section */}
        {stockton6Game && (
          <>
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

            {/* Stockton 6's Round Totals */}
            <GameRoundTotals
              gameName="Stockton 6's"
              playerResults={calculateStockton6(currentRound, stockton6Game).playerResults}
              players={currentRound.players}
              icon={<span className="text-lg">🎯</span>}
              accentColor="amber"
            />
          </>
        )}

        {/* Team Banker Round Totals */}
        {currentRound.games
          .filter(g => g.type === GameType.TEAM_BANKER)
          .map(game => {
            const result = calculateTeamBanker(currentRound, game);
            return (
              <GameRoundTotals
                key={game.id}
                gameName="Team Banker"
                playerResults={result.playerResults}
                players={currentRound.players}
                icon={<span className="text-lg">👥🏦</span>}
                accentColor="primary"
              />
            );
          })}

        {/* 6's Match Play Section */}
        {sixesGame && (
          <SixesMatchSummary round={currentRound} game={sixesGame} />
        )}
      </div>

      <ScorecardImage ref={scorecardImageRef} currentRound={currentRound} roundTotals={roundTotals} />

      <div className="p-4 bg-card border-t border-border flex gap-3">
        <Button variant="outline" onClick={() => scorecardImageRef.current?.shareImage()} className="flex-1">
          <Share2 className="w-4 h-4 mr-2" /> Share Image
        </Button>
        {(() => {
          const allHolesComplete = currentRound.course.holes.every(hole => {
            const holeScores = currentRound.scores[hole.number];
            if (!holeScores) return false;
            return currentRound.players.every(p => {
              const score = holeScores[p.id];
              return score !== undefined && score !== null && score > 0;
            });
          });

          if (allHolesComplete) {
            return (
              <Button onClick={() => navigate('/summary')} className="flex-1">
                <Flag className="w-4 h-4 mr-2" /> Round Complete
              </Button>
            );
          }

          const firstIncompleteHole = currentRound.course.holes.find(hole => {
            const holeScores = currentRound.scores[hole.number];
            if (!holeScores) return true;
            return !currentRound.players.every(p => {
              const score = holeScores[p.id];
              return typeof score === 'number' && score > 0;
            });
          })?.number || 1;
          return (
            <Button onClick={() => navigate('/active', { state: { startHole: firstIncompleteHole } })} className="flex-1">
              <Play className="w-4 h-4 mr-2" /> Return to Hole
            </Button>
          );
        })()}
      </div>
    </div>
  );
};

export default Scorecard;
