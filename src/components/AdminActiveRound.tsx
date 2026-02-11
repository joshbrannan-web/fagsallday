import React, { useState, useMemo } from 'react';
import { useAdminRound } from '@/contexts/AdminRoundContext';
import { ChevronLeft, ChevronRight, Crown, Home, TrendingDown, Flame, DollarSign, Check, Bird, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { calculateAggregatedHolePnL, calculateBloodyBankerPnL, areHolesComplete } from '../services/gameEngine';
import { calculateRelativeStrokes, getTeamAssignment, getStretchForHole, getHolePressInfo, calculateGreenieCarryoverForHole } from '../services/stockton6Engine';
import { GameType, GameSettings, PlayerHoleDots } from '../types';
import { Stockton6StatusBar } from './stockton6';

const AdminActiveRound: React.FC = () => {
  const navigate = useNavigate();
  const { currentRound, roundTotals } = useAdminRound();
  const [activeHole, setActiveHole] = useState(1);

  // Bloody Banker "Down the Most" logic for holes 16, 17, 18
  const bloodyBankerDownPlayer = useMemo(() => {
    if (!currentRound) return null;
    
    // Include both explicit Bloody Banker games AND regular Banker games with activation flag
    const bloodyBankerGames = currentRound.games.filter(g => 
      g.type === GameType.BLOODY_BANKER || 
      (g.type === GameType.BANKER && currentRound.gameData?.[g.id]?.[0]?.['_META_BLOODY_ACTIVATED'] === true)
    );
    if (bloodyBankerGames.length === 0) return null;
    
    if (activeHole < 16 || activeHole > 18) return null;
    
    const previousHole = activeHole - 1;
    
    if (!areHolesComplete(currentRound, previousHole)) return null;
    
    const downPlayers: { game: GameSettings; playerId: string; amount: number }[] = [];
    
    bloodyBankerGames.forEach(game => {
      const pnl = calculateBloodyBankerPnL(currentRound, game, previousHole);
      
      let lowestPlayerId: string | null = null;
      let lowestAmount = 0;
      
      currentRound.players.forEach(p => {
        const playerPnL = pnl[p.id] || 0;
        if (playerPnL < lowestAmount) {
          lowestAmount = playerPnL;
          lowestPlayerId = p.id;
        }
      });
      
      if (lowestPlayerId && lowestAmount < 0) {
        downPlayers.push({ game, playerId: lowestPlayerId, amount: lowestAmount });
      }
    });
    
    return downPlayers.length > 0 ? downPlayers : null;
  }, [currentRound, activeHole]);

  if (!currentRound) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-center space-y-6">
        <h2 className="text-xl font-bold">No Round Data</h2>
        <Button onClick={() => navigate('/admin')}>
          <Home className="w-5 h-5 mr-2" /> Back to Admin
        </Button>
      </div>
    );
  }

  const courseHole = currentRound.course.holes.find(h => h.number === activeHole);
  const holePnL = calculateAggregatedHolePnL(currentRound);
  const bankerGame = currentRound.games.find(g => g.type === GameType.BANKER || g.type === GameType.BLOODY_BANKER);
  const bloodyBankerGames = currentRound.games.filter(g => g.type === GameType.BLOODY_BANKER);
  const stockton6Game = currentRound.games.find(g => g.type === GameType.STOCKTON_6);
  const fboGames = currentRound.games.filter(g => g.type === GameType.FBO);
  const openBetGames = currentRound.games.filter(g => g.type === GameType.OPEN_BETTING);

  const getBankerForHole = (holeNum: number): string | null => {
    if (!bankerGame) return null;
    const holeData = currentRound.gameData?.[bankerGame.id]?.[holeNum];
    return holeData?._META_BANKER_ID || holeData?.bankerId || null;
  };

  const bankerId = getBankerForHole(activeHole);
  const bankerMult = bankerGame ? (currentRound.gameData?.[bankerGame.id]?.[activeHole]?.['_META_BANKER_MULT'] || 1) : 1;

  // Get press info for Stockton 6's
  const pressInfo = stockton6Game ? getHolePressInfo(currentRound, stockton6Game.id, activeHole) : null;
  const hasAnyPress = pressInfo && (pressInfo.oneBall.front || pressInfo.oneBall.back || pressInfo.twoBall.front || pressInfo.twoBall.back);

  // Get Stockton 6's dots data
  const getStockton6Dots = () => {
    if (!stockton6Game) return null;
    const dotsData: { [playerId: string]: PlayerHoleDots } = {};
    currentRound.players.forEach(p => {
      const playerDots = currentRound.gameData?.[stockton6Game.id]?.[activeHole]?.dots?.[p.id] || {};
      dotsData[p.id] = playerDots;
    });
    return dotsData;
  };

  const stockton6Dots = getStockton6Dots();
  const greenieCarryover = stockton6Game ? calculateGreenieCarryoverForHole(currentRound, stockton6Game.id, activeHole) : 1;

  return (
    <div className="flex flex-col">
      {/* Hole Navigation */}
      <div className="bg-brand-dark text-primary-foreground p-4 shadow-lg">
        <div className="flex flex-col items-center text-center mb-4">
          <h1 className="text-2xl font-bold">Hole {activeHole}</h1>
          <div className="flex gap-3 text-xs text-muted-foreground font-mono tracking-wider">
            <span>PAR {courseHole?.par}</span>
            <span className="opacity-50">|</span>
            <span>{courseHole?.yardage} YDS</span>
            <span className="opacity-50">|</span>
            <span>IDX {courseHole?.handicapIndex}</span>
          </div>
        </div>
        <div className="flex justify-between items-center gap-4">
          <button 
            disabled={activeHole === 1}
            onClick={() => setActiveHole(h => h - 1)}
            className="bg-primary p-3 rounded-xl disabled:opacity-30"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {currentRound.course.holes.map(h => (
              <button
                key={h.number}
                onClick={() => setActiveHole(h.number)}
                className={`w-8 h-8 rounded-full text-sm font-bold transition-colors ${
                  activeHole === h.number 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-white/10 text-white/70 hover:bg-white/20'
                }`}
              >
                {h.number}
              </button>
            ))}
          </div>
          <button 
            disabled={activeHole === 18}
            onClick={() => setActiveHole(h => h + 1)}
            className="bg-primary p-3 rounded-xl disabled:opacity-30"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Stockton 6's Status Bar */}
        {stockton6Game && (
          <Stockton6StatusBar
            round={currentRound}
            game={stockton6Game}
            currentHole={activeHole}
          />
        )}

        {/* Press Indicator */}
        {hasAnyPress && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
            <div className="flex items-center gap-2">
              <Flame className="w-5 h-5 text-amber-500" />
              <span className="font-bold text-amber-600 uppercase text-sm">Press Triggered</span>
            </div>
            <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
              {pressInfo?.oneBall.front && <span>1-Ball Front</span>}
              {pressInfo?.oneBall.back && <span>1-Ball Back</span>}
              {pressInfo?.twoBall.front && <span>2-Ball Front</span>}
              {pressInfo?.twoBall.back && <span>2-Ball Back</span>}
            </div>
          </div>
        )}

        {/* Banker Info with Multiplier */}
        {bankerGame && (
          <div className="bg-card rounded-xl p-4 border border-brand-gold/30">
            <h3 className="font-bold text-sm text-muted-foreground mb-2 flex items-center gap-2">
              <Crown className="w-4 h-4 text-brand-gold" /> Banker
            </h3>
            {bankerId ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="bg-brand-gold text-brand-dark px-3 py-1 rounded-lg font-bold">
                    {currentRound.players.find(p => p.id === bankerId)?.name || 'Unknown'}
                  </div>
                </div>
                {bankerMult > 1 && (
                  <div className="bg-brand-dark text-primary-foreground px-3 py-1 rounded-lg font-bold text-sm">
                    {bankerMult === 2 ? 'Double' : bankerMult === 3 ? 'Triple' : 'PreQuad'} All
                  </div>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No banker selected</p>
            )}
          </div>
        )}

        {/* Bloody Banker: Down the Most Display */}
        {bloodyBankerDownPlayer && bloodyBankerDownPlayer.map(({ game, playerId, amount }) => {
          const downPlayer = currentRound.players.find(p => p.id === playerId);
          const holeData = currentRound.gameData?.[game.id]?.[activeHole] || {};
          const stakeMult = holeData['_META_BANKER_MULT'] || 1;
          
          if (!downPlayer) return null;
          
          return (
            <div key={`bloody-down-${game.id}`} className="bg-gradient-to-r from-destructive/10 to-destructive/5 rounded-xl border-2 border-destructive/50 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="bg-destructive text-destructive-foreground p-1.5 rounded-lg">
                    <TrendingDown className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground text-sm">🩸 Bloody Banker - Hole {activeHole}</h3>
                    <p className="text-xs text-muted-foreground">Down player sets the stakes</p>
                  </div>
                </div>
                <Flame className="w-4 h-4 text-destructive" />
              </div>
              
              <div className="bg-card rounded-xl p-3 border border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-destructive/20 border-2 border-destructive flex items-center justify-center">
                      <span className="font-bold text-destructive">{downPlayer.name.substring(0, 2).toUpperCase()}</span>
                    </div>
                    <div>
                      <div className="font-bold text-foreground">{downPlayer.name}</div>
                      <div className="text-xs text-destructive font-mono font-bold">
                        Down ${Math.abs(amount)} after {activeHole - 1} holes
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground uppercase font-bold">Stake Selected</div>
                    <div className="text-lg font-bold text-brand-gold">
                      {stakeMult === 1 ? 'Standard' : stakeMult === 2 ? 'Double' : stakeMult === 3 ? 'Triple' : 'PreQuad'}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Custom Base Bets Display */}
              <div className="mt-3 pt-3 border-t border-border/50">
                <div className="text-xs font-bold text-muted-foreground uppercase mb-2">
                  Custom Base Bets
                </div>
                <div className="space-y-1">
                  {currentRound.players.filter(p => p.id !== holeData['_META_BANKER_ID']).map(player => {
                    const stakeKey = `_STAKE_${player.id}`;
                    const defaultStake = game.unitStake * stakeMult;
                    const currentStake = holeData[stakeKey] !== undefined ? holeData[stakeKey] : defaultStake;
                    const isCustom = currentStake !== defaultStake;
                    
                    return (
                      <div key={player.id} className="flex items-center justify-between bg-card rounded-lg p-2 border border-border">
                        <span className="font-medium text-sm text-foreground">{player.name}</span>
                        <span className={`font-mono font-bold ${isCustom ? 'text-primary' : 'text-muted-foreground'}`}>
                          ${currentStake}
                          {isCustom && <span className="text-xs ml-1">(custom)</span>}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}


        {/* Stockton 6's Dots Display */}
        {stockton6Game && stockton6Dots && Object.values(stockton6Dots).some(d => d.birdie || d.greenie || d.dotMultiplier) && (
          <div className="bg-card rounded-xl border border-primary/50 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-foreground flex items-center gap-2">
                <span className="text-lg">6️⃣</span> Dots Awarded
              </h3>
              {greenieCarryover > 1 && courseHole?.par === 3 && (
                <div className="bg-success/20 text-success px-2 py-1 rounded-lg text-xs font-bold">
                  Greenie worth {greenieCarryover}x (carryover!)
                </div>
              )}
            </div>
            <div className="space-y-2">
              {currentRound.players.map(player => {
                const dots = stockton6Dots[player.id];
                if (!dots.birdie && !dots.greenie && !dots.dotMultiplier) return null;
                
                return (
                  <div key={player.id} className="flex items-center justify-between bg-muted/50 rounded-lg p-2">
                    <span className="font-medium">{player.name}</span>
                    <div className="flex items-center gap-2">
                      {dots.birdie && (
                        <span className="bg-amber-500/20 text-amber-600 px-2 py-1 rounded text-xs font-bold flex items-center gap-1">
                          <Bird className="w-3 h-3" /> Birdie
                        </span>
                      )}
                      {dots.greenie && (
                        <span className="bg-success/20 text-success px-2 py-1 rounded text-xs font-bold">
                          ⛳️ Greenie {greenieCarryover > 1 ? `(${greenieCarryover}x)` : ''}
                        </span>
                      )}
                      {dots.dotMultiplier && dots.dotMultiplier > 1 && (
                        <span className="bg-primary/20 text-primary px-2 py-1 rounded text-xs font-bold flex items-center gap-1">
                          <Target className="w-3 h-3" /> {dots.dotMultiplier}x Dot
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Open Betting Display */}
        {openBetGames.length > 0 && (() => {
          const hasAnyBets = openBetGames.some(game => 
            currentRound.players.some(p => {
              const bet = currentRound.gameData?.[game.id]?.[activeHole]?.[p.id];
              return bet !== undefined && bet !== 0;
            })
          );
          
          if (!hasAnyBets) return null;
          
          return openBetGames.map(game => (
            <div key={game.id} className="bg-card rounded-xl border border-border p-4">
              <h3 className="font-bold text-sm text-muted-foreground mb-3 flex items-center gap-2">
                <DollarSign className="w-4 h-4" /> Open Side Bets
              </h3>
              <div className="space-y-2">
                {currentRound.players.map(player => {
                  const bet = currentRound.gameData?.[game.id]?.[activeHole]?.[player.id] || 0;
                  if (bet === 0) return null;
                  
                  return (
                    <div key={player.id} className="flex items-center justify-between bg-muted/50 rounded-lg p-2">
                      <span className="font-medium">{player.name}</span>
                      <span className={`font-mono font-bold ${bet > 0 ? 'text-success' : 'text-destructive'}`}>
                        {bet > 0 ? `+$${bet}` : `-$${Math.abs(bet)}`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ));
        })()}

        {/* Player Scores */}
        <div className="space-y-3">
          <h3 className="font-bold text-sm text-muted-foreground">Player Scores</h3>
          {currentRound.players.map(player => {
            const score = currentRound.scores[activeHole]?.[player.id];
            const playerPnL = holePnL[activeHole]?.[player.id] || 0;
            const isBanker = bankerId === player.id;
            
            // Check for strokes
            const manualStrokes = currentRound.gameData?.['MANUAL_STROKES']?.[activeHole]?.[player.id];
            let hasStroke = manualStrokes === 1;
            if (manualStrokes === undefined && stockton6Game && courseHole) {
              const autoStrokes = calculateRelativeStrokes(currentRound.players, courseHole.handicapIndex);
              hasStroke = autoStrokes[player.id] === 1;
            }
            
            // Get player multiplier for banker game
            const playerMult = bankerGame ? (currentRound.gameData?.[bankerGame.id]?.[activeHole]?.[player.id] || 1) : 1;

            return (
              <div 
                key={player.id}
                className={`flex items-center justify-between p-4 rounded-xl border-2 ${
                  isBanker ? 'border-brand-gold bg-brand-gold/5' : 'border-border bg-card'
                }`}
              >
                <div className="flex items-center gap-3">
                  {isBanker && <Crown className="w-5 h-5 text-brand-gold" />}
                  <div>
                    <span className="font-semibold">{player.name}</span>
                    {hasStroke && (
                      <span className="ml-2 inline-block w-4 h-4 bg-primary rounded-full text-primary-foreground text-[10px] leading-4 text-center font-bold">
                        •
                      </span>
                    )}
                    {/* Player multiplier badge */}
                    {!isBanker && playerMult > 1 && bankerGame && (
                      <span className="ml-2 bg-primary/20 text-primary px-2 py-0.5 rounded text-xs font-bold">
                        {playerMult}x Press
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`text-sm font-mono ${
                    playerPnL > 0 ? 'text-success' : playerPnL < 0 ? 'text-destructive' : 'text-muted-foreground'
                  }`}>
                    {playerPnL !== 0 ? (playerPnL > 0 ? `+$${playerPnL}` : `-$${Math.abs(playerPnL)}`) : '$0'}
                  </span>
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold ${
                    score !== undefined && score !== null
                      ? 'bg-primary/10 text-primary'
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {score ?? '-'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Round Totals */}
      <div className="p-4 border-t border-border mt-auto">
        <h3 className="font-bold text-sm text-muted-foreground mb-3">Round Totals</h3>
        <div className="grid grid-cols-2 gap-2">
          {currentRound.players.map(player => (
            <div key={player.id} className="bg-card rounded-lg p-3 border border-border flex justify-between items-center">
              <span className="text-sm font-medium truncate">{player.name}</span>
              <span className={`font-mono font-bold ${
                (roundTotals[player.id] || 0) >= 0 ? 'text-success' : 'text-destructive'
              }`}>
                ${roundTotals[player.id] || 0}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminActiveRound;
