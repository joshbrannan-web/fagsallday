import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Check, Coins, RotateCcw, Users, Calculator } from 'lucide-react';
import { toast } from 'sonner';
import GameSelector from '@/components/GameSelector';
import type { GameSettings, Player } from '@/types';
import { calculateSideBets, type SideBetResults, type SideBetPlayerInput } from '@/services/sideBets';

interface Props {
  tournamentId: string;
  players: any[]; // tournament_players rows
  rounds: any[];  // tournament_rounds rows
}

const MAX_PLAYERS = 4;

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex items-center gap-2">
    <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-[0.2em]">{children}</span>
    <div className="flex-1 h-px bg-border/40" />
  </div>
);

const money = (n: number) => `${n < 0 ? '-' : ''}$${Math.abs(n).toFixed(2)}`;

const SideBetsPanel: React.FC<Props> = ({ tournamentId, players, rounds }) => {
  const [roundId, setRoundId] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [games, setGames] = useState<GameSettings[]>([]);
  const [holeScores, setHoleScores] = useState<any[]>([]);
  const [loadingScores, setLoadingScores] = useState(false);
  const [results, setResults] = useState<SideBetResults | null>(null);

  const round = rounds.find((r) => r.id === roundId);

  // Load gross scores for the chosen round
  useEffect(() => {
    if (!roundId) { setHoleScores([]); return; }
    let cancelled = false;
    setLoadingScores(true);
    (async () => {
      const { data: groups } = await supabase
        .from('tournament_groups')
        .select('id')
        .eq('tournament_round_id', roundId)
        .eq('is_test', false);
      const groupIds = (groups || []).map((g: any) => g.id);
      if (groupIds.length === 0) {
        if (!cancelled) { setHoleScores([]); setLoadingScores(false); }
        return;
      }
      const { data } = await supabase
        .from('tournament_hole_scores')
        .select('tournament_player_id, hole_number, gross_score')
        .in('tournament_group_id', groupIds);
      if (!cancelled) { setHoleScores(data || []); setLoadingScores(false); }
    })();
    return () => { cancelled = true; };
  }, [roundId]);

  const scoredPlayerIds = useMemo(
    () => new Set(holeScores.filter((s) => s.gross_score != null).map((s) => s.tournament_player_id)),
    [holeScores],
  );

  const selectedPlayers: SideBetPlayerInput[] = useMemo(
    () =>
      selectedIds
        .map((id) => players.find((p) => p.id === id))
        .filter(Boolean)
        .map((p: any) => ({
          id: p.id,
          displayName: p.display_name,
          handicapIndex: Number(p.handicap_override ?? p.handicap_index ?? 0),
        })),
    [selectedIds, players],
  );

  // GameSelector expects app Player objects
  const selectorPlayers: Player[] = useMemo(
    () =>
      selectedPlayers.map((p) => ({
        id: p.id,
        name: p.displayName,
        handicapIndex: p.handicapIndex,
        courseHandicap: 0,
        tee: 'White',
      })),
    [selectedPlayers],
  );

  const togglePlayer = (id: string) => {
    setResults(null);
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        const next = prev.filter((p) => p !== id);
        setGames([]);
        return next;
      }
      if (prev.length >= MAX_PLAYERS) {
        toast.error(`Side bets support up to ${MAX_PLAYERS} players`);
        return prev;
      }
      setGames([]);
      return [...prev, id];
    });
  };

  const reset = () => {
    setRoundId('');
    setSelectedIds([]);
    setGames([]);
    setResults(null);
    setHoleScores([]);
  };

  const handleCalculate = () => {
    if (!round?.course_data) { toast.error('This round has no course set up yet'); return; }
    if (selectedPlayers.length < 2) { toast.error('Choose at least 2 players'); return; }
    if (games.length === 0) { toast.error('Choose at least one game'); return; }
    try {
      const res = calculateSideBets(round.course_data, selectedPlayers, games, holeScores);
      if (res.holesCounted.length === 0) {
        toast.error('No holes have scores for all selected players yet');
        return;
      }
      setResults(res);
    } catch (e: any) {
      toast.error(e?.message || 'Could not calculate side bets');
    }
  };

  const canPickPlayers = !!roundId;
  const canPickGames = selectedPlayers.length >= 2;

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-[hsl(var(--brand-gold))]" />
            <div>
              <h3 className="font-semibold text-sm">Side Bets</h3>
              <p className="text-xs text-muted-foreground">
                Pick a round, 2-4 players and a game to see who owes who. Nothing is saved — hit Reset to start over.
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={reset} className="gap-1 shrink-0">
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </Button>
        </div>
      </Card>

      {/* Step 1 — round */}
      <div className="space-y-2">
        <SectionLabel>1 · Round</SectionLabel>
        {rounds.length === 0 ? (
          <p className="text-sm text-muted-foreground">No rounds in this tournament yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {rounds.map((r) => (
              <button
                key={r.id}
                onClick={() => { setRoundId(r.id); setResults(null); }}
                className={`p-3 rounded-lg border text-left transition-all ${
                  roundId === r.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="text-sm font-medium">
                  Round {r.round_number}{r.name ? ` — ${r.name}` : ''}
                </div>
                <div className="text-xs text-muted-foreground">
                  {(r.course_data as any)?.name || 'No course'}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Step 2 — players */}
      {canPickPlayers && (
        <div className="space-y-2">
          <SectionLabel>2 · Players ({selectedIds.length}/{MAX_PLAYERS})</SectionLabel>
          {loadingScores ? (
            <Skeleton className="h-24 w-full rounded-lg" />
          ) : (
            <div className="space-y-2">
              {players.map((p: any) => {
                const isSelected = selectedIds.includes(p.id);
                const hasScores = scoredPlayerIds.has(p.id);
                const hcp = Number(p.handicap_override ?? p.handicap_index ?? 0);
                return (
                  <button
                    key={p.id}
                    onClick={() => togglePlayer(p.id)}
                    className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${
                      isSelected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                        {isSelected && <Check className="w-4 h-4" />}
                      </div>
                      <div className="text-left">
                        <div className="text-sm font-medium">{p.display_name}</div>
                        <div className="text-xs text-muted-foreground">HCP {hcp}</div>
                      </div>
                    </div>
                    {!hasScores && <Badge variant="outline" className="text-[10px]">No scores</Badge>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Step 3 — games */}
      {canPickGames && (
        <div className="space-y-2">
          <SectionLabel>3 · Game &amp; Bet</SectionLabel>
          <GameSelector
            players={selectorPlayers}
            selectedGames={games}
            onGamesChange={(g) => { setGames(g); setResults(null); }}
            isTournamentMode
          />
          <Button className="w-full gap-2" onClick={handleCalculate} disabled={games.length === 0}>
            <Calculator className="w-4 h-4" /> Calculate Results
          </Button>
        </div>
      )}

      {/* Results */}
      {results && (
        <div className="space-y-3">
          <SectionLabel>Results</SectionLabel>
          <Card className="p-4 space-y-3">
            <p className="text-xs text-muted-foreground">
              Based on {results.holesCounted.length} hole{results.holesCounted.length === 1 ? '' : 's'} with scores for all selected players
              {results.holesCounted.length > 0 && ` (holes ${results.holesCounted.join(', ')})`}.
            </p>

            {results.perGame.map((g) => (
              <div key={g.gameId} className="space-y-1">
                <div className="text-xs font-semibold">{g.gameName}</div>
                <div className="space-y-1">
                  {results.totals.map((t) => {
                    const amt = g.playerResults?.[t.playerId] || 0;
                    return (
                      <div key={t.playerId} className="flex items-center justify-between text-sm">
                        <span>{t.name}</span>
                        <span className={amt > 0 ? 'text-success font-medium' : amt < 0 ? 'text-destructive font-medium' : 'text-muted-foreground'}>
                          {money(amt)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            <div className="pt-2 border-t border-border space-y-1">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total</div>
              {results.totals.map((t) => (
                <div key={t.playerId} className="flex items-center justify-between text-sm font-medium">
                  <span>{t.name}</span>
                  <span className={t.amount > 0 ? 'text-success' : t.amount < 0 ? 'text-destructive' : 'text-muted-foreground'}>
                    {money(t.amount)}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Who Owes Who</span>
            </div>
            {results.settlement.length === 0 ? (
              <p className="text-sm text-muted-foreground">All square — nobody owes anything.</p>
            ) : (
              results.settlement.map((s, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span><span className="font-medium">{s.from}</span> pays <span className="font-medium">{s.to}</span></span>
                  <span className="font-semibold">{money(s.amount)}</span>
                </div>
              ))
            )}
          </Card>

          <Button variant="outline" className="w-full gap-2" onClick={reset}>
            <RotateCcw className="w-4 h-4" /> Reset &amp; Run Another
          </Button>
        </div>
      )}
    </div>
  );
};

export default SideBetsPanel;
