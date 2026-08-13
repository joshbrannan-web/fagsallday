import React from 'react';

interface TeamSummary {
  id: string;
  name: string;
  color?: string;
  points: number;
}

interface Props {
  leadingTeamName?: string;
  leadingTeamColor?: string;
  leadAmount: number;
  holesPlayed: number;
  isComplete: boolean;
  resultLabel: string;
  teamA?: TeamSummary;
  teamB?: TeamSummary;
}

const fmt = (n: number) => (Number.isInteger(n) ? n.toString() : n.toFixed(1));

const MatchStatusBar: React.FC<Props> = ({
  leadingTeamColor, holesPlayed, isComplete, resultLabel, teamA, teamB,
}) => {
  const hasTeams = !!teamA && !!teamB;

  let statusLine = resultLabel || 'ALL SQUARE';
  if (hasTeams) {
    const a = teamA!.points;
    const b = teamB!.points;
    const hi = Math.max(a, b);
    const lo = Math.min(a, b);
    const leader = a > b ? teamA! : teamB!;
    if (holesPlayed === 0) {
      statusLine = 'Not Started';
    } else if (isComplete) {
      statusLine = a === b ? `Match Halved ${fmt(a)} — ${fmt(b)}` : `${leader.name} wins ${fmt(hi)} — ${fmt(lo)}`;
    } else {
      statusLine = a === b
        ? `All Square ${fmt(a)} — ${fmt(b)} · Thru ${holesPlayed}`
        : `${leader.name} leads ${fmt(hi)} — ${fmt(lo)} · Thru ${holesPlayed}`;
    }
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4 text-center space-y-2">
      {hasTeams ? (
        <>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: teamA!.color }} />
              <span className={`font-semibold text-sm ${teamA!.points >= teamB!.points ? 'text-foreground' : 'text-muted-foreground'}`}>
                {teamA!.name}
              </span>
            </div>
            <div className="text-3xl font-bold font-mono">
              {fmt(teamA!.points)}
              <span className="text-muted-foreground text-lg"> — </span>
              {fmt(teamB!.points)}
            </div>
            <div className="flex items-center gap-2">
              <span className={`font-semibold text-sm ${teamB!.points >= teamA!.points ? 'text-foreground' : 'text-muted-foreground'}`}>
                {teamB!.name}
              </span>
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: teamB!.color }} />
            </div>
          </div>
          <p className={`text-sm ${isComplete ? 'font-bold text-[hsl(var(--brand-gold))]' : 'text-muted-foreground'}`}>
            {statusLine}
          </p>
          <p className="text-xs text-muted-foreground">
            {isComplete ? 'Final' : `Thru ${holesPlayed}`}
          </p>
        </>
      ) : (
        <>
          <p className="text-2xl font-bold" style={leadingTeamColor ? { color: leadingTeamColor } : undefined}>
            {statusLine}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {isComplete ? 'Final' : `Thru ${holesPlayed}`}
          </p>
        </>
      )}
    </div>
  );
};

export default MatchStatusBar;
