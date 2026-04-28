import React, { useMemo, useState } from 'react';
import { Hammer as HammerIcon, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { GameSettings, Round } from '@/types';
import {
  getHammerVariant, getHammerSegmentLength, getHammerHoleTeams,
  getHammerSegmentForHole, getHammerSegmentStartHole, getHammerHoleState,
  calculateHammerPot, calculateHammerHole, isHammerSegmentStartHole,
} from '@/services/hammerEngine';

interface HammerStatusBarProps {
  round: Round;
  game: GameSettings;
  activeHole: number;
  onUpdateGameData: (gameId: string, hole: number, updates: Record<string, any>) => void;
  isReadOnly?: boolean;
}

export const HammerStatusBar: React.FC<HammerStatusBarProps> = ({
  round, game, activeHole, onUpdateGameData, isReadOnly,
}) => {
  const variant = getHammerVariant(game);
  const segLen = getHammerSegmentLength(game);
  const teams = getHammerHoleTeams(round.gameData, game.id, activeHole, variant, segLen);
  const { hammerCount, lastThrownBy } = getHammerHoleState(round.gameData, game.id, activeHole);
  const pot = calculateHammerPot(game.unitStake, hammerCount);
  const result = calculateHammerHole(round, game, activeHole);
  const settled = result?.winningTeam !== undefined && result?.winningTeam !== null;

  const [throwSide, setThrowSide] = useState<'A' | 'B' | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);
  const [draftA, setDraftA] = useState<string[]>([]);
  const [draftB, setDraftB] = useState<string[]>([]);
  const [draftSolo, setDraftSolo] = useState<string | null>(null);

  const players = round.players;
  const hammerPlayers = useMemo(() => {
    const ids = game.config.gamePlayers || players.map(p => p.id);
    return players.filter(p => ids.includes(p.id));
  }, [players, game.config.gamePlayers]);

  // Auto-open setup ONLY for Team Hammer (segment teams must be set up-front).
  // LR Hammer defers team selection until the user enters scores / advances.
  const needsSetup = !teams && !isReadOnly && variant === 'team';
  React.useEffect(() => {
    if (needsSetup) {
      setDraftA([]); setDraftB([]); setDraftSolo(null);
      setSetupOpen(true);
    } else {
      setSetupOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeHole, teams ? '1' : '0', variant]);

  const teamNameStr = (ids: string[]) =>
    ids.map(id => players.find(p => p.id === id)?.name || '?').join(' & ');

  const handleThrow = (side: 'A' | 'B') => {
    if (isReadOnly || settled) return;
    if (lastThrownBy === side) return; // not your turn
    setThrowSide(side);
  };

  const confirmThrow = () => {
    if (!throwSide) return;
    onUpdateGameData(game.id, activeHole, {
      hammerCount: hammerCount + 1,
      lastThrownBy: throwSide,
    });
    setThrowSide(null);
  };

  const saveSetup = () => {
    if (variant === 'team') {
      // Team Hammer: store at segment start
      const seg = getHammerSegmentForHole(activeHole, segLen);
      const startHole = getHammerSegmentStartHole(seg, segLen);
      onUpdateGameData(game.id, startHole, {
        _META_TEAM_A: draftA,
        _META_TEAM_B: draftB,
        _META_LOCKED: true,
      });
    } else {
      // LR per-hole
      if (hammerPlayers.length === 3 && draftSolo) {
        const pair = hammerPlayers.filter(p => p.id !== draftSolo).map(p => p.id);
        onUpdateGameData(game.id, activeHole, {
          lrTeamA: pair,
          lrTeamB: [draftSolo],
          lrSolo: draftSolo,
        });
      } else {
        onUpdateGameData(game.id, activeHole, {
          lrTeamA: draftA,
          lrTeamB: draftB,
          lrSolo: undefined,
        });
      }
    }
    setSetupOpen(false);
  };

  const togglePlayerInTeam = (pid: string, team: 'A' | 'B') => {
    if (variant === 'team') {
      // Team Hammer: 4 players, 2v2 strict
      if (team === 'A') {
        if (draftA.includes(pid)) {
          setDraftA(draftA.filter(x => x !== pid));
        } else if (draftA.length < 2) {
          setDraftA([...draftA, pid]);
          setDraftB(draftB.filter(x => x !== pid));
        }
      } else {
        if (draftB.includes(pid)) {
          setDraftB(draftB.filter(x => x !== pid));
        } else if (draftB.length < 2) {
          setDraftB([...draftB, pid]);
          setDraftA(draftA.filter(x => x !== pid));
        }
      }
    } else {
      // LR 4p: 2v2 (toggle into A; rest auto-B)
      if (draftA.includes(pid)) {
        setDraftA(draftA.filter(x => x !== pid));
      } else if (draftA.length < 2) {
        setDraftA([...draftA, pid]);
      }
    }
  };

  // For LR 4-player setup, derive teamB from non-A
  React.useEffect(() => {
    if (variant === 'lr' && hammerPlayers.length === 4) {
      setDraftB(hammerPlayers.map(p => p.id).filter(id => !draftA.includes(id)));
    }
  }, [draftA, variant, hammerPlayers]);

  const setupValid = variant === 'team'
    ? (draftA.length === 2 && draftB.length === 2)
    : (hammerPlayers.length === 3 ? !!draftSolo : draftA.length === 2);

  // ------- Render -------

  return (
    <>
      {/* LR placeholder when teams not yet set for this hole */}
      {!teams && variant === 'lr' && !isReadOnly && (
        <div
          id={`hammer-card-${game.id}`}
          data-hammer-needs-teams="true"
          className="rounded-2xl border border-dashed border-primary/40 bg-card p-3 shadow-sm"
        >
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="flex items-center gap-2">
              <HammerIcon className="w-5 h-5 text-primary" />
              <span className="text-sm font-bold">Hammer · Hole {activeHole}</span>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Pot</div>
              <div className="text-2xl font-extrabold tabular-nums">${game.unitStake}</div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mb-2">
            Pick teams when you enter scores for this hole.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => {
              setDraftA([]); setDraftB([]); setDraftSolo(null);
              setSetupOpen(true);
            }}
          >
            <Users className="w-4 h-4 mr-1" /> Set teams now
          </Button>
        </div>
      )}

      {/* Status bar */}
      {teams && (
        <div id={`hammer-card-${game.id}`} className="rounded-2xl border border-border bg-card p-3 shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="flex items-center gap-2">
              <HammerIcon className="w-5 h-5 text-primary" />
              <span className="text-sm font-bold">Hammer · Hole {activeHole}</span>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Pot</div>
              <div className="text-2xl font-extrabold tabular-nums">${pot}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-2">
            <div className="rounded-lg p-2 bg-primary/10 border border-primary/30">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Team A</div>
              <div className="text-xs font-medium truncate">{teamNameStr(teams.teamA)}</div>
            </div>
            <div className="rounded-lg p-2 bg-destructive/10 border border-destructive/30">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {result?.isSolo && teams.teamB.length === 1 ? 'Solo' : 'Team B'}
              </div>
              <div className="text-xs font-medium truncate">{teamNameStr(teams.teamB)}</div>
            </div>
          </div>

          {hammerCount > 0 && (
            <div className="text-xs text-muted-foreground mb-2">
              {hammerCount} hammer{hammerCount > 1 ? 's' : ''} thrown {lastThrownBy ? `(last: Team ${lastThrownBy})` : ''}
            </div>
          )}

          {!isReadOnly && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                disabled={lastThrownBy === 'A'}
                onClick={() => handleThrow('A')}
              >
                <HammerIcon className="w-4 h-4 mr-1" /> A throws
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                disabled={lastThrownBy === 'B'}
                onClick={() => handleThrow('B')}
              >
                <HammerIcon className="w-4 h-4 mr-1" /> B throws
              </Button>
            </div>
          )}

          {variant === 'lr' && !isReadOnly && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-2"
              onClick={() => {
                setDraftA(teams.teamA);
                setDraftB(teams.teamB);
                setDraftSolo(teams.solo || null);
                setSetupOpen(true);
              }}
            >
              <Users className="w-4 h-4 mr-1" /> Change teams for this hole
            </Button>
          )}
        </div>
      )}

      {/* Throw confirmation */}
      <AlertDialog open={!!throwSide} onOpenChange={(o) => !o && setThrowSide(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Throw the Hammer?</AlertDialogTitle>
            <AlertDialogDescription>
              Team {throwSide} doubles the pot from <b>${pot}</b> to <b>${pot * 2}</b>.
              The other team will need to accept or throw it back.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmThrow}>Throw it (${pot * 2})</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Setup dialog */}
      <AlertDialog open={setupOpen} onOpenChange={(o) => !o && teams && setSetupOpen(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {variant === 'team'
                ? `Hammer Teams · Holes ${getHammerSegmentStartHole(getHammerSegmentForHole(activeHole, segLen), segLen)}–${Math.min(getHammerSegmentStartHole(getHammerSegmentForHole(activeHole, segLen), segLen) + segLen - 1, 18)}`
                : `Hammer Teams · Hole ${activeHole}`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {variant === 'team'
                ? 'Pick 2 players for each team. Teams stay fixed for this segment.'
                : hammerPlayers.length === 3
                  ? 'Pick the solo player. The other two are the team.'
                  : 'Pick 2 players for Team A. The remaining 2 are Team B.'}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-3">
            {hammerPlayers.length === 3 && variant === 'lr' ? (
              <div className="space-y-2">
                <Label>Solo player</Label>
                <div className="flex flex-wrap gap-2">
                  {hammerPlayers.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setDraftSolo(p.id)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                        draftSolo === p.id
                          ? 'bg-destructive text-destructive-foreground'
                          : 'bg-background border border-border text-muted-foreground'
                      }`}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Team A {variant === 'lr' && '(opponents auto-assigned to B)'}</Label>
                  <div className="flex flex-wrap gap-2">
                    {hammerPlayers.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => togglePlayerInTeam(p.id, 'A')}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                          draftA.includes(p.id)
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-background border border-border text-muted-foreground'
                        }`}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                </div>
                {variant === 'team' && (
                  <div className="space-y-2">
                    <Label>Team B</Label>
                    <div className="flex flex-wrap gap-2">
                      {hammerPlayers.map(p => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => togglePlayerInTeam(p.id, 'B')}
                          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                            draftB.includes(p.id)
                              ? 'bg-destructive text-destructive-foreground'
                              : 'bg-background border border-border text-muted-foreground'
                          }`}
                        >
                          {p.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <AlertDialogFooter>
            {teams && <AlertDialogCancel>Cancel</AlertDialogCancel>}
            <AlertDialogAction disabled={!setupValid} onClick={saveSetup}>
              Save Teams
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default HammerStatusBar;
