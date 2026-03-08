// ... keep all the existing imports and logic (getTeamScore, completedHoles, etc.) ...

// Replace only the return statement:
return (
  <div className="rounded-xl border border-border overflow-hidden bg-card">
    {/* Column headers */}
    <div className="grid grid-cols-[44px_1fr_1fr_72px] px-3 py-1.5 bg-muted/30 border-b border-border">
      <span className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-wider">Hole</span>
      <span
        className="text-[9px] font-bold uppercase tracking-wider text-center"
        style={{ color: teamA?.color + "cc" }}
      >
        {teamA?.name.split(" ")[0]}
      </span>
      <span
        className="text-[9px] font-bold uppercase tracking-wider text-center"
        style={{ color: teamB?.color + "cc" }}
      >
        {teamB?.name.split(" ")[0]}
      </span>
      <span className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-wider text-right">Result</span>
    </div>

    <div className="max-h-[340px] overflow-y-auto divide-y divide-border/50">
      {completedHoles.map((hole, idx) => {
        const r = holeResults[hole.number];
        if (!r) return null;

        const aPts = r.teamPoints[teamMatchup.teamAId] || 0;
        const bPts = r.teamPoints[teamMatchup.teamBId] || 0;
        const isAWin = aPts > bPts;
        const isBWin = bPts > aPts;
        const isHalved = aPts === bPts && aPts > 0;

        const aScore = getTeamScore(r, teamMatchup.teamAId);
        const bScore = getTeamScore(r, teamMatchup.teamBId);

        const winnerColor = isAWin ? teamA?.color : isBWin ? teamB?.color : undefined;
        const winPts = Math.max(aPts, bPts);

        return (
          <div
            key={hole.number}
            className={`grid grid-cols-[44px_1fr_1fr_72px] items-center px-3 py-2 ${
              idx % 2 !== 0 ? "bg-muted/20" : ""
            }`}
          >
            {/* Hole + par */}
            <div className="flex items-baseline gap-1">
              <span className="text-[13px] font-bold font-mono text-foreground">{hole.number}</span>
              <span className="text-[10px] text-muted-foreground/50">p{hole.par}</span>
            </div>

            {/* Score A */}
            <div className="flex justify-center">
              {aScore !== undefined ? (
                <ScoreChip score={aScore} par={hole.par} isWinner={isAWin} winColor={teamA?.color} />
              ) : (
                <span className="text-muted-foreground/30 text-sm">—</span>
              )}
            </div>

            {/* Score B */}
            <div className="flex justify-center">
              {bScore !== undefined ? (
                <ScoreChip score={bScore} par={hole.par} isWinner={isBWin} winColor={teamB?.color} />
              ) : (
                <span className="text-muted-foreground/30 text-sm">—</span>
              )}
            </div>

            {/* Result */}
            <div className="flex justify-end">
              {isHalved ? (
                <span className="text-[10px] text-muted-foreground font-semibold">½ ea</span>
              ) : isAWin || isBWin ? (
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                  style={{ color: winnerColor, backgroundColor: winnerColor + "18" }}
                >
                  +{winPts}pt
                </span>
              ) : (
                <span className="text-[10px] text-muted-foreground/40">—</span>
              )}
            </div>
          </div>
        );
      })}

      {unplayedHoles.map((hole, idx) => (
        <div
          key={`unplayed-${hole.number}`}
          className="grid grid-cols-[44px_1fr_1fr_72px] items-center px-3 py-2 opacity-25"
        >
          <div className="flex items-baseline gap-1">
            <span className="text-[13px] font-bold font-mono">{hole.number}</span>
            <span className="text-[10px] text-muted-foreground/50">p{hole.par}</span>
          </div>
          <span className="text-center text-muted-foreground text-sm">—</span>
          <span className="text-center text-muted-foreground text-sm">—</span>
          <span className="text-right text-muted-foreground text-xs">—</span>
        </div>
      ))}
    </div>
  </div>
);
