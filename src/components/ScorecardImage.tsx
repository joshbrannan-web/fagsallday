import React, { useRef, useImperativeHandle } from 'react';
import { Crown } from 'lucide-react';
import { toPng } from 'html-to-image';
import { toast } from 'sonner';
import { calculateAggregatedHolePnL } from '../services/gameEngine';
import { calculateRelativeStrokes } from '../services/stockton6Engine';
import { GameType, Round } from '../types';

export interface ScorecardImageHandle {
  shareImage: () => Promise<void>;
}

interface ScorecardImageProps {
  currentRound: Round;
  roundTotals: Record<string, number>;
}

const ScorecardImage = React.forwardRef<ScorecardImageHandle, ScorecardImageProps>(
  ({ currentRound, roundTotals }, ref) => {
    const scorecardRef = useRef<HTMLDivElement>(null);

    const holes = currentRound.course.holes;

    const holePnL = calculateAggregatedHolePnL(currentRound);

    const getPlayerScore = (pid: string, holeNum: number) => {
      const score = currentRound.scores[holeNum]?.[pid];
      return typeof score === 'number' ? score : '-';
    };

    const getPlayerHoleMoney = (pid: string, holeNum: number) => {
      return holePnL[holeNum]?.[pid] || 0;
    };

    const bankerGames = currentRound.games.filter(g =>
      g.type === GameType.BANKER || g.type === GameType.BLOODY_BANKER
    );
    const getBankerForHole = (holeNum: number): string | null => {
      for (const game of bankerGames) {
        const holeData = currentRound.gameData?.[game.id]?.[holeNum];
        const bankerId = holeData?._META_BANKER_ID || holeData?.bankerId;
        if (bankerId) return bankerId;
      }
      return null;
    };

    const stockton6Game = currentRound.games.find(g => g.type === GameType.STOCKTON_6);

    const calculateTotalScore = (pid: string) => {
      let total = 0;
      holes.forEach(h => {
        const s = currentRound.scores[h.number]?.[pid];
        if (typeof s === 'number') total += s;
      });
      return total;
    };

    const handleShareImage = async () => {
      if (!scorecardRef.current) return;

      try {
        toast.info('Generating scorecard image...');

        const dataUrl = await toPng(scorecardRef.current, {
          quality: 0.95,
          backgroundColor: '#ffffff',
          pixelRatio: 2,
          style: { opacity: '1' },
        });

        const response = await fetch(dataUrl);
        const blob = await response.blob();
        const file = new File([blob], 'scorecard.png', { type: 'image/png' });

        if (navigator.share && navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: `${currentRound.course.name} Scorecard`,
            files: [file],
          });
        } else {
          const link = document.createElement('a');
          link.download = `scorecard-${currentRound.course.name.replace(/\s+/g, '-')}.png`;
          link.href = dataUrl;
          link.click();
          toast.success('Scorecard image downloaded!');
        }
      } catch (err) {
        console.error('Share image failed:', err);
        toast.error('Failed to generate image');
      }
    };

    useImperativeHandle(ref, () => ({
      shareImage: handleShareImage,
    }));

    return (
      <div
        ref={scorecardRef}
        className="fixed top-0 left-0 opacity-0 pointer-events-none z-[-1]"
        style={{ width: '1200px' }}
        aria-hidden="true"
      >
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          border: '1px solid #dfe2e7',
          overflow: 'hidden'
        }}>
          {/* Header */}
          <div style={{
            backgroundColor: 'rgba(245,243,239,0.5)',
            padding: '12px 16px',
            borderBottom: '1px solid #dfe2e7'
          }}>
            <div style={{ textAlign: 'center' }}>
              <h3 style={{ fontWeight: 700, color: '#1e2530', fontSize: '18px', margin: 0 }}>
                {currentRound.course.name}
              </h3>
              <p style={{ fontSize: '12px', color: '#737a85', marginTop: '4px' }}>
                {new Date(currentRound.startTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
          </div>

          {/* Full 18-hole table */}
          <table style={{ width: '100%', textAlign: 'center', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f5f3ef' }}>
                <th style={{
                  padding: '12px',
                  textAlign: 'left',
                  minWidth: '100px',
                  backgroundColor: '#f5f3ef',
                  borderRight: '1px solid #dfe2e7',
                  fontSize: '12px',
                  fontWeight: 700,
                  color: '#737a85',
                  textTransform: 'uppercase'
                }}>Player</th>
                {holes.map(h => (
                  <th key={h.number} style={{
                    padding: '8px',
                    minWidth: '40px',
                    borderRight: '1px solid rgba(223,226,231,0.5)',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#737a85',
                    textTransform: 'uppercase'
                  }}>
                    {h.number}
                    <div style={{ fontSize: '10px', color: '#737a85', fontWeight: 400, marginTop: '2px' }}>par {h.par}</div>
                    <div style={{ fontSize: '10px', color: '#737a85', fontWeight: 400 }}>IDX {h.handicapIndex}</div>
                  </th>
                ))}
                <th style={{
                  padding: '8px',
                  minWidth: '50px',
                  backgroundColor: '#f5f3ef',
                  fontSize: '12px',
                  fontWeight: 700,
                  color: '#737a85',
                  textTransform: 'uppercase'
                }}>
                  Total
                  <div style={{ fontSize: '10px', color: '#737a85', fontWeight: 400, marginTop: '2px' }}>
                    par {currentRound.course.holes.reduce((sum, h) => sum + h.par, 0)}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {currentRound.players.map((player, idx) => (
                <React.Fragment key={player.id}>
                  <tr style={{ backgroundColor: idx % 2 === 0 ? '#ffffff' : 'rgba(245,243,239,0.3)' }}>
                    <td style={{
                      padding: '12px',
                      textAlign: 'left',
                      fontWeight: 600,
                      backgroundColor: 'inherit',
                      borderRight: '1px solid #dfe2e7',
                      color: '#1e2530'
                    }}>
                      {player.name}
                    </td>
                    {holes.map(h => {
                      const score = getPlayerScore(player.id, h.number);
                      const diff = typeof score === 'number' ? score - h.par : 0;
                      let hasStroke = currentRound.gameData?.['MANUAL_STROKES']?.[h.number]?.[player.id] === 1;
                      if (!hasStroke && stockton6Game) {
                        const autoStrokes = calculateRelativeStrokes(currentRound.players, h.handicapIndex);
                        hasStroke = autoStrokes[player.id] === 1;
                      }
                      const isBanker = getBankerForHole(h.number) === player.id;

                      const getScoreStyle = (): React.CSSProperties => {
                        const base: React.CSSProperties = {
                          display: 'inline-block',
                          width: '32px',
                          height: '32px',
                          lineHeight: '32px',
                          fontSize: '14px',
                          fontWeight: 700,
                        };
                        if (diff <= -2) return { ...base, borderRadius: '50%', backgroundColor: 'rgba(245,178,10,0.2)', color: '#f5b20a' };
                        if (diff === -1) return { ...base, borderRadius: '50%', backgroundColor: 'rgba(34,197,94,0.2)', color: '#22c55e' };
                        if (diff === 0) return { ...base, color: '#1e2530' };
                        if (diff === 1) return { ...base, borderRadius: '8px', border: '2px solid #1e2530', color: '#ef4444' };
                        return { ...base, borderRadius: '8px', border: '2px solid #1e2530', outline: '2px solid #1e2530', outlineOffset: '2px', color: '#ef4444' };
                      };

                      return (
                        <td key={h.number} style={{ padding: '8px', borderRight: '1px solid rgba(223,226,231,0.5)' }}>
                          <div style={{ position: 'relative', display: 'inline-block' }}>
                            <span style={getScoreStyle()}>
                              {score}
                            </span>
                            {hasStroke && (
                              <span style={{
                                position: 'absolute',
                                top: '-4px',
                                right: '-4px',
                                width: '12px',
                                height: '12px',
                                backgroundColor: '#2a9d8f',
                                borderRadius: '50%',
                                border: '1px solid #ffffff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}>
                                <span style={{ fontSize: '8px', color: '#ffffff', fontWeight: 700 }}>•</span>
                              </span>
                            )}
                            {isBanker && (
                              <Crown
                                style={{
                                  position: 'absolute',
                                  top: '-4px',
                                  right: '-4px',
                                  width: '12px',
                                  height: '12px',
                                  color: '#f5b20a'
                                }}
                              />
                            )}
                          </div>
                        </td>
                      );
                    })}
                    <td style={{ padding: '8px', fontWeight: 700, color: '#1e2530' }}>{calculateTotalScore(player.id) || '-'}</td>
                  </tr>
                  <tr style={{ fontSize: '12px', backgroundColor: idx % 2 === 0 ? '#ffffff' : 'rgba(245,243,239,0.3)' }}>
                    <td style={{
                      padding: '0 12px 8px 12px',
                      textAlign: 'left',
                      color: '#737a85',
                      backgroundColor: 'inherit',
                      borderRight: '1px solid #dfe2e7'
                    }}>HCP {player.courseHandicap}</td>
                    {holes.map(h => {
                      const money = getPlayerHoleMoney(player.id, h.number);
                      const getMoneyColor = () => {
                        if (money > 0) return '#22c55e';
                        if (money < 0) return '#ef4444';
                        return '#737a85';
                      };
                      return (
                        <td key={h.number} style={{ padding: '0 8px 8px 8px', borderRight: '1px solid rgba(223,226,231,0.5)' }}>
                          <span style={{ fontFamily: 'monospace', color: getMoneyColor() }}>
                            {money !== 0 ? (money > 0 ? `+${money}` : money) : '-'}
                          </span>
                        </td>
                      );
                    })}
                    <td style={{ padding: '0 8px 8px 8px' }}>
                      <span style={{
                        fontFamily: 'monospace',
                        fontWeight: 700,
                        color: (roundTotals[player.id] || 0) >= 0 ? '#22c55e' : '#ef4444'
                      }}>
                        ${roundTotals[player.id] || 0}
                      </span>
                    </td>
                  </tr>
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }
);

ScorecardImage.displayName = 'ScorecardImage';

export default ScorecardImage;
