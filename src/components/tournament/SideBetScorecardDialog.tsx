import React, { useMemo, useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import type { Course, GameSettings } from '@/types';
import { GameType } from '@/types';
import { calculateStrokesReceived, calculateFBOStrokes } from '@/services/gameEngine';
import { buildSideBetRound, calculateSideBets, type SideBetPlayerInput } from '@/services/sideBets';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseData: Course;
  players: SideBetPlayerInput[];
  games: GameSettings[];
  holeScores: { tournament_player_id: string; hole_number: number; gross_score: number | null }[];
}

const money = (n: number) => `${n < 0 ? '-' : ''}$${Math.abs(n).toFixed(2)}`;

const SideBetScorecardDialog: React.FC<Props> = ({
  open, onOpenChange, courseData, players, games, holeScores,
}) => {
  const [gameId, setGameId] = useState<string>(games[0]?.id || '');

  useEffect(() => {
    if (!games.some((g) => g.id === gameId)) setGameId(games[0]?.id || '');
  }, [games, gameId]);

  const data = useMemo(() => {
    if (!open || players.length === 0) return null;
    try {
      const { round, holesCounted } = buildSideBetRound(courseData, players, games, holeScores);
      const results = calculateSideBets(courseData, players, games, holeScores);
      return { round, holesCounted: new Set(holesCounted), results };
    } catch {
      return null;
    }
  }, [open, courseData, players, games, holeScores]);

  const holes = courseData?.holes || [];
  const front = holes.filter((h) => h.number <= 9);
  const back = holes.filter((h) => h.number > 9);

  const activeGame = useMemo(
    () => data?.round.games.find((g) => g.id === gameId) || data?.round.games[0],
    [data, gameId],
  );

  /**
   * Per-hole strokes for every player, using the SAME handicap rules the
   * selected game uses to pay out (relative vs absolute, FBO cancellation,
   * or no handicaps at all).
   */
  const strokeMap = useMemo(() => {
    const map: Record<number, Record<string, number>> = {};
    if (!data) return map;
    const roundPlayers = data.round.players;
    const useHandicaps = activeGame ? activeGame.config.useHandicaps !== false : true;
    const isFBO = activeGame?.type === GameType.FBO;
    const mode: 'absolute' | 'relative' = isFBO
      ? (activeGame?.config.fbo?.handicapMode || 'absolute')
      : ((activeGame?.config.handicapMode as 'absolute' | 'relative') || 'absolute');
    const lowest = Math.min(...roundPlayers.map((p) => p.courseHandicap));

    holes.forEach((h) => {
      const perHole: Record<string, number> = {};
      if (!useHandicaps) {
        roundPlayers.forEach((p) => { perHole[p.id] = 0; });
      } else if (isFBO) {
        const s = calculateFBOStrokes(roundPlayers, h.handicapIndex, mode);
        roundPlayers.forEach((p) => { perHole[p.id] = s[p.id] || 0; });
      } else if (mode === 'relative') {
        roundPlayers.forEach((p) => {
          perHole[p.id] = calculateStrokesReceived(p.courseHandicap - lowest, h.handicapIndex);
        });
      } else {
        roundPlayers.forEach((p) => {
          perHole[p.id] = calculateStrokesReceived(p.courseHandicap, h.handicapIndex);
        });
      }
      map[h.number] = perHole;
    });
    return map;
  }, [data, activeGame, holes]);

  const strokesOn = (playerId: string, holeNumber: number): number =>
    strokeMap[holeNumber]?.[playerId] || 0;

  const netOf = (playerId: string, holeNumber: number): number | null => {
    if (!data) return null;
    const gross = data.round.scores[holeNumber]?.[playerId];
    if (gross == null) return null;
    return gross - strokesOn(playerId, holeNumber);
  };

  /** Winner(s) of a hole by lowest net, using the selected game's handicap rules. */
  const winnersOn = (holeNumber: number): string[] => {
    if (!data || !data.holesCounted.has(holeNumber)) return [];
    const nets = players
      .map((p) => ({ id: p.id, net: netOf(p.id, holeNumber) }))
      .filter((x) => x.net != null) as { id: string; net: number }[];
    if (nets.length < 2) return [];
    const low = Math.min(...nets.map((n) => n.net));
    const winners = nets.filter((n) => n.net === low);
    return winners.length === nets.length ? [] : winners.map((w) => w.id);
  };

  /** Human-readable summary of the handicap rule in force. */
  const handicapNote = useMemo(() => {
    if (!data || !activeGame) return '';
    if (activeGame.config.useHandicaps === false) return 'Scratch — no handicap strokes in this game.';
    const isFBO = activeGame.type === GameType.FBO;
    const mode = isFBO
      ? (activeGame.config.fbo?.handicapMode || 'absolute')
      : (activeGame.config.handicapMode || 'absolute');
    const parts = data.round.players
      .map((p) => {
        const total = holes.reduce((s, h) => s + (strokeMap[h.number]?.[p.id] || 0), 0);
        return `${p.name.split(' ')[0]} ${total}`;
      })
      .join(', ');
    return `${mode === 'relative' ? 'Relative' : 'Absolute'} handicaps (${activeGame.name}). Strokes given: ${parts}.`;
  }, [data, activeGame, holes, strokeMap]);


  const renderSegment = (segHoles: typeof holes, label: string) => {
    if (segHoles.length === 0) return null;
    const parTotal = segHoles.reduce((s, h) => s + (h.par || 0), 0);

    return (
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-muted/50">
              <th className="sticky left-0 z-10 bg-muted/50 text-left px-2 py-1 font-semibold min-w-[110px]">Hole</th>
              {segHoles.map((h) => (
                <th key={h.number} className="px-1 py-1 text-center font-semibold w-9">{h.number}</th>
              ))}
              <th className="px-2 py-1 text-center font-semibold">{label}</th>
            </tr>
            <tr className="border-b border-border">
              <td className="sticky left-0 z-10 bg-background px-2 py-1 text-muted-foreground">Par</td>
              {segHoles.map((h) => (
                <td key={h.number} className="px-1 py-1 text-center text-muted-foreground">{h.par}</td>
              ))}
              <td className="px-2 py-1 text-center text-muted-foreground font-medium">{parTotal}</td>
            </tr>
          </thead>
          <tbody>
            {players.map((p) => {
              let grossTotal = 0;
              let netTotal = 0;
              return (
                <tr key={p.id} className="border-b border-border/50">
                  <td className="sticky left-0 z-10 bg-background px-2 py-1 font-medium truncate max-w-[130px]">
                    {p.displayName}
                  </td>
                  {segHoles.map((h) => {
                    const gross = data?.round.scores[h.number]?.[p.id] ?? null;
                    const net = netOf(p.id, h.number);
                    if (gross != null) grossTotal += gross;
                    if (net != null) netTotal += net;
                    const isWinner = winnersOn(h.number).includes(p.id);
                    const strokes = strokesOn(p.id, h.number);
                    return (
                      <td key={h.number} className="px-1 py-1 text-center relative">
                        {gross == null ? (
                          <span className="text-muted-foreground/30">–</span>
                        ) : (
                          <span
                            className={`inline-flex flex-col items-center leading-none rounded px-1 py-0.5 ${
                              isWinner ? 'bg-primary/15 text-primary font-bold ring-1 ring-primary/40' : ''
                            }`}
                          >
                            <span>{gross}</span>
                            <span className="text-[9px] text-muted-foreground">{net}</span>
                          </span>
                        )}
                        {strokes > 0 && (
                          <span
                            className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-[hsl(var(--brand-gold))]"
                            title={`${strokes} stroke${strokes > 1 ? 's' : ''}`}
                          />
                        )}
                      </td>
                    );
                  })}
                  <td className="px-2 py-1 text-center font-semibold">
                    {grossTotal || '–'}
                    <span className="block text-[9px] text-muted-foreground font-normal">{netTotal || ''}</span>
                  </td>
                </tr>
              );
            })}
            <tr className="bg-muted/30">
              <td className="sticky left-0 z-10 bg-muted/30 px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                Hole winner
              </td>
              {segHoles.map((h) => {
                const w = winnersOn(h.number);
                const played = data?.holesCounted.has(h.number);
                return (
                  <td key={h.number} className="px-1 py-1 text-center text-[9px]">
                    {!played ? (
                      <span className="text-muted-foreground/30">–</span>
                    ) : w.length === 0 ? (
                      <span className="text-muted-foreground">½</span>
                    ) : (
                      <span className="font-semibold text-primary">
                        {w
                          .map((id) => players.find((p) => p.id === id)?.displayName?.split(' ')[0] || '')
                          .join('/')}
                      </span>
                    )}
                  </td>
                );
              })}
              <td className="px-2 py-1" />
            </tr>
          </tbody>
        </table>
      </div>
    );
  };

  const perGame = data?.results.perGame || [];
  const totals = data?.results.totals || [];
  const settlement = data?.results.settlement || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">
            Scorecard &amp; Results
            <span className="block text-xs font-normal text-muted-foreground">
              {courseData?.name || 'Course'} · {players.map((p) => p.displayName).join(', ')}
            </span>
          </DialogTitle>
        </DialogHeader>

        {!data ? (
          <p className="text-sm text-muted-foreground">
            Not enough shared holes with scores to build a scorecard for these players.
          </p>
        ) : (
          <div className="space-y-4">
            <Card className="p-2 space-y-3">
              {renderSegment(front, 'Out')}
              {renderSegment(back, 'In')}
              <p className="text-[10px] text-muted-foreground px-2">
                Big number = gross, small number = net. Gold dot = handicap stroke on that hole. Highlighted cells
                won the hole on net; ½ means the hole was halved.
              </p>
            </Card>

            {perGame.length > 0 && (
              <Card className="p-4 space-y-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Game results</div>
                {perGame.map((g) => (
                  <div key={g.gameId} className="space-y-1">
                    <div className="text-xs font-semibold">{g.gameName}</div>
                    {players.map((p) => {
                      const amt = g.playerResults?.[p.id] || 0;
                      return (
                        <div key={p.id} className="flex items-center justify-between text-sm">
                          <span>{p.displayName}</span>
                          <span className={amt > 0 ? 'text-success font-medium' : amt < 0 ? 'text-destructive font-medium' : 'text-muted-foreground'}>
                            {money(amt)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ))}

                <div className="pt-2 border-t border-border space-y-1">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total</div>
                  {totals.map((t) => (
                    <div key={t.playerId} className="flex items-center justify-between text-sm font-medium">
                      <span>{t.name}</span>
                      <span className={t.amount > 0 ? 'text-success' : t.amount < 0 ? 'text-destructive' : 'text-muted-foreground'}>
                        {money(t.amount)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="pt-2 border-t border-border space-y-1">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Who owes who</div>
                  {settlement.length === 0 ? (
                    <p className="text-sm text-muted-foreground">All square.</p>
                  ) : (
                    settlement.map((s, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span>
                          <span className="font-medium">{s.from}</span> pays <span className="font-medium">{s.to}</span>
                        </span>
                        <span className="font-semibold">{money(s.amount)}</span>
                      </div>
                    ))
                  )}
                </div>
              </Card>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SideBetScorecardDialog;
