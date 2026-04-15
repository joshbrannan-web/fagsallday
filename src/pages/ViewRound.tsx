import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, ArrowLeft, UserPlus } from 'lucide-react';
import { Round, GameSettings, Player, Course, GameData } from '@/types';
import { calculatePerGameTotals, calculateRoundTotals, calculateSettlement, formatMoney } from '@/services/gameEngine';

interface PublicRoundData {
  id: string;
  course: Course;
  players: Player[];
  scores: Record<string, Record<string, number>>;
  status: string;
  startTime: string;
  games: GameSettings[];
  gameData: GameData;
}

const ViewRound = () => {
  const { roundId } = useParams<{ roundId: string }>();
  const navigate = useNavigate();
  const [round, setRound] = useState<PublicRoundData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRound = async () => {
      if (!roundId) return;
      try {
        const { data, error: fnError } = await supabase.functions.invoke('get-public-round', {
          body: { round_id: roundId },
        });
        if (fnError) throw fnError;
        if (data?.error) {
          setError(data.error);
        } else {
          setRound(data);
        }
      } catch (e: any) {
        setError(e.message || 'Failed to load round');
      } finally {
        setLoading(false);
      }
    };
    fetchRound();
  }, [roundId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !round) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-6 space-y-4">
            <p className="text-muted-foreground">{error || 'Round not found'}</p>
            <Button variant="outline" onClick={() => navigate('/')}>
              Go Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const holes = round.course.holes || [];
  const totalHoles = holes.length || 18;
  const frontNine = Array.from({ length: Math.min(9, totalHoles) }, (_, i) => i + 1);
  const backNine = totalHoles > 9 ? Array.from({ length: Math.min(9, totalHoles - 9) }, (_, i) => i + 10) : [];

  const getPlayerTotal = (playerId: string, holeNumbers: number[]) => {
    let total = 0;
    for (const h of holeNumbers) {
      const score = round.scores?.[h]?.[playerId];
      if (score) total += score;
    }
    return total || '-';
  };

  // Build a minimal Round object for game engine calculations
  const buildRoundForEngine = (): Round => ({
    id: round.id,
    course: round.course,
    players: round.players,
    games: round.games || [],
    scores: round.scores || {},
    gameData: round.gameData || {},
    status: (round.status as Round['status']) || 'ACTIVE',
    startTime: new Date(round.startTime).getTime(),
  });

  const engineRound = buildRoundForEngine();
  const hasGames = engineRound.games.length > 0;

  // Calculate game results
  const perGameResults = hasGames ? calculatePerGameTotals(engineRound) : [];
  const roundTotals = hasGames ? calculateRoundTotals(engineRound) : {};

  // Build settlement data
  const settlementInput = round.players.map(p => ({
    name: p.name,
    amount: roundTotals[p.id] || 0,
  }));
  const settlements = hasGames ? calculateSettlement(settlementInput) : [];

  const renderScoreTable = (holeNumbers: number[], label: string) => (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="sticky left-0 bg-background z-10 min-w-[80px]">{label}</TableHead>
            {holeNumbers.map(h => (
              <TableHead key={h} className="text-center min-w-[40px]">{h}</TableHead>
            ))}
            <TableHead className="text-center font-bold min-w-[48px]">Tot</TableHead>
          </TableRow>
          {holes.length > 0 && (
            <TableRow>
              <TableCell className="sticky left-0 bg-background z-10 text-xs text-muted-foreground">Par</TableCell>
              {holeNumbers.map(h => {
                const hole = holes[h - 1];
                return <TableCell key={h} className="text-center text-xs text-muted-foreground">{hole?.par || '-'}</TableCell>;
              })}
              <TableCell className="text-center text-xs font-medium text-muted-foreground">
                {holeNumbers.reduce((sum, h) => sum + (holes[h - 1]?.par || 0), 0) || '-'}
              </TableCell>
            </TableRow>
          )}
        </TableHeader>
        <TableBody>
          {round.players.map(player => (
            <TableRow key={player.id}>
              <TableCell className="sticky left-0 bg-background z-10 font-medium text-sm truncate max-w-[100px]">
                {player.name}
              </TableCell>
              {holeNumbers.map(h => {
                const score = round.scores?.[h]?.[player.id];
                return (
                  <TableCell key={h} className="text-center text-sm">
                    {score || '-'}
                  </TableCell>
                );
              })}
              <TableCell className="text-center font-bold text-sm">
                {getPlayerTotal(player.id, holeNumbers)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Sign-up banner */}
      <div className="bg-primary/10 border-b border-primary/20 px-4 py-2 flex items-center justify-between">
        <span className="text-sm text-primary">Want full access? Track your own scores and more.</span>
        <Button size="sm" variant="default" onClick={() => navigate(`/auth?mode=signup&round_id=${roundId}`)}>
          <UserPlus className="mr-1 h-4 w-4" />
          Sign Up
        </Button>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">{round.course.name || 'Round'}</h1>
            <p className="text-sm text-muted-foreground">
              {new Date(round.startTime).toLocaleDateString()} · {round.status === 'ACTIVE' ? '🟢 Live' : round.status}
            </p>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Front 9</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {renderScoreTable(frontNine, 'Hole')}
          </CardContent>
        </Card>

        {backNine.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Back 9</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {renderScoreTable(backNine, 'Hole')}
            </CardContent>
          </Card>
        )}

        {/* Game Results */}
        {hasGames && perGameResults.length > 0 && (
          <>
            {perGameResults.map(gameResult => (
              <Card key={gameResult.gameId}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{gameResult.gameName}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    {round.players
                      .filter(p => gameResult.playerResults[p.id] !== undefined)
                      .sort((a, b) => (gameResult.playerResults[b.id] || 0) - (gameResult.playerResults[a.id] || 0))
                      .map(player => {
                        const amount = gameResult.playerResults[player.id] || 0;
                        return (
                          <div key={player.id} className="flex justify-between items-center py-1">
                            <span className="text-sm font-medium">{player.name}</span>
                            <span className={`text-sm font-semibold ${amount > 0 ? 'text-green-600' : amount < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                              {formatMoney(amount)}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* Overall Totals */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Overall Totals</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {round.players
                    .sort((a, b) => (roundTotals[b.id] || 0) - (roundTotals[a.id] || 0))
                    .map(player => {
                      const amount = roundTotals[player.id] || 0;
                      return (
                        <div key={player.id} className="flex justify-between items-center py-1">
                          <span className="text-sm font-medium">{player.name}</span>
                          <span className={`text-sm font-bold ${amount > 0 ? 'text-green-600' : amount < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                            {formatMoney(amount)}
                          </span>
                        </div>
                      );
                    })}
                </div>
              </CardContent>
            </Card>

            {/* Who Pays Who */}
            {settlements.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Who Pays Who</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {settlements.map((s, i) => (
                      <div key={i} className="flex items-center justify-between py-1 text-sm">
                        <span><span className="font-medium">{s.from}</span> → <span className="font-medium">{s.to}</span></span>
                        <span className="font-semibold">${s.amount.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ViewRound;
