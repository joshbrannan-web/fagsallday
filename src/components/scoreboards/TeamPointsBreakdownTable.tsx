import React, { useState } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Props {
  teams: any[];
  rounds: any[];
  groups: Record<string, any[]>;
  groupPlayers: Record<string, any[]>;
  players: any[];
  holeResults: any[];
  joinCode: string;
  teamScoringMethod?: 'cumulative' | 'round_win' | 'custom_pts_per_round';
  customRoundPoints?: number;
}

const TeamPointsBreakdownTable: React.FC<Props> = ({
  teams, rounds, groups, groupPlayers, players, holeResults, joinCode, teamScoringMethod, customRoundPoints,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedRounds, setExpandedRounds] = useState<Set<string>>(new Set());
  const navigate = useNavigate();

  if (teams.length < 2) return null;
  const teamA = teams[0];
  const teamB = teams[1];

  const startedRounds = rounds.filter((r: any) => r.status !== 'pending');

  const toggleRound = (roundId: string) => {
    setExpandedRounds(prev => {
      const next = new Set(prev);
      next.has(roundId) ? next.delete(roundId) : next.add(roundId);
      return next;
    });
  };

  const getGroupTeamPoints = (groupId: string) => {
    const results = holeResults.filter((r: any) => r.tournament_group_id === groupId);
    const totals: Record<string, number> = { [teamA.id]: 0, [teamB.id]: 0 };
    results.forEach((r: any) => {
      const tp = r.team_points as Record<string, number>;
      if (tp) {
        Object.entries(tp).forEach(([tid, pts]) => {
          totals[tid] = (totals[tid] || 0) + Number(pts);
        });
      }
    });
    return totals;
  };

  const getGroupPlayerNames = (groupId: string, teamId: string) => {
    const gps = groupPlayers[groupId] || [];
    return gps
      .filter((gp: any) => gp.team_id === teamId)
      .map((gp: any) => {
        const p = players.find((p: any) => p.id === gp.tournament_player_id);
        return p ? p.display_name.split(' ')[0] : '?';
      })
      .join(', ');
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full text-muted-foreground">
          {isOpen ? 'Hide' : 'Show'} Breakdown
          <ChevronDown className={`w-4 h-4 ml-1 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-2 pt-2">
        {startedRounds.map((round: any) => {
          const roundGroups = groups[round.id] || [];
          const isExpanded = expandedRounds.has(round.id);

          // Round totals
          let roundA = 0, roundB = 0;
          roundGroups.forEach((g: any) => {
            const pts = getGroupTeamPoints(g.id);
            roundA += pts[teamA.id] || 0;
            roundB += pts[teamB.id] || 0;
          });

          const isRoundWin = teamScoringMethod === 'round_win' || teamScoringMethod === 'custom_pts_per_round';
          const rwValue = teamScoringMethod === 'custom_pts_per_round' ? (customRoundPoints || 3) : 1;
          const isCompleted = round.status === 'completed';
          let displayA = roundA, displayB = roundB;
          if (isRoundWin && isCompleted) {
            displayA = roundA > roundB ? rwValue : roundA === roundB ? rwValue / 2 : 0;
            displayB = roundB > roundA ? rwValue : roundA === roundB ? rwValue / 2 : 0;
          }

          return (
            <div key={round.id} className="border rounded-lg overflow-hidden">
              <button
                onClick={() => toggleRound(round.id)}
                className="w-full flex items-center justify-between px-3 py-2 text-sm bg-muted/30 hover:bg-muted/50"
              >
                <div className="flex items-center gap-2">
                  {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  <span className="font-medium">{round.name || `Round ${round.round_number}`}</span>
                  <span className="text-xs text-muted-foreground">{roundGroups.length} groups</span>
                </div>
                <div className="flex items-center gap-2 font-mono text-xs">
                  <span style={{ color: teamA.color }}>{displayA}</span>
                  <span className="text-muted-foreground">—</span>
                  <span style={{ color: teamB.color }}>{displayB}</span>
                </div>
              </button>

              {isExpanded && roundGroups.map((group: any) => {
                const pts = getGroupTeamPoints(group.id);
                const pA = pts[teamA.id] || 0;
                const pB = pts[teamB.id] || 0;
                const resultLabel = pA > pB ? `${teamA.name} wins` : pB > pA ? `${teamB.name} wins` : 'Halved';

                return (
                  <button
                    key={group.id}
                    onClick={() => navigate(`/tournament/${joinCode}/round/${round.id}/group/${group.id}`)}
                    className="w-full flex items-center justify-between px-4 py-2 text-xs border-t hover:bg-muted/30"
                  >
                    <div className="text-left">
                      <span className="text-muted-foreground">Group {group.group_number}: </span>
                      <span>{getGroupPlayerNames(group.id, teamA.id)}</span>
                      <span className="text-muted-foreground"> vs </span>
                      <span>{getGroupPlayerNames(group.id, teamB.id)}</span>
                    </div>
                    <div className="flex items-center gap-2 font-mono shrink-0 ml-2">
                      <span>{pA}</span>
                      <span className="text-muted-foreground">—</span>
                      <span>{pB}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        pA > pB ? 'bg-success/20 text-success' :
                        pB > pA ? 'bg-destructive/20 text-destructive' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {resultLabel}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          );
        })}
      </CollapsibleContent>
    </Collapsible>
  );
};

export default TeamPointsBreakdownTable;
