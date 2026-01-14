import React from 'react';
import { Round, GameSettings } from '@/types';
import { calculateStockton6, validateStockton6Totals, getTeamAssignment } from '@/services/stockton6Engine';
import { Trophy, TrendingDown, CheckCircle, AlertTriangle, Share } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface Stockton6RoundSummaryProps {
  round: Round;
  game: GameSettings;
}

const Stockton6RoundSummary: React.FC<Stockton6RoundSummaryProps> = ({
  round,
  game
}) => {
  const result = calculateStockton6(round, game);
  const isBalanced = validateStockton6Totals(result.playerResults);
  
  // Get stretch results for table
  const getStretchResult = (playerId: string, stretch: 1 | 2 | 3): number => {
    const stretchEndHole = stretch * 6;
    return result.holeResults?.[stretchEndHole]?.[playerId] || 0;
  };

  // Sort players by total
  const sortedPlayers = [...round.players]
    .filter(p => result.playerResults[p.id] !== undefined)
    .sort((a, b) => (result.playerResults[b.id] || 0) - (result.playerResults[a.id] || 0));

  const handleShare = async () => {
    const lines = [
      `🏌️ Stockton 6's Results`,
      `Course: ${round.course.name}`,
      ``,
      `Player Results:`,
      ...sortedPlayers.map((p, i) => {
        const total = result.playerResults[p.id] || 0;
        const prefix = total > 0 ? '+' : '';
        const rank = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
        return `${rank} ${p.name}: ${prefix}$${total}`;
      }),
      ``,
      isBalanced ? '✓ Totals balanced' : '⚠️ Check results - totals do not balance'
    ];
    
    const text = lines.join('\n');
    
    try {
      if (navigator.share) {
        await navigator.share({ text });
      } else {
        await navigator.clipboard.writeText(text);
        toast.success('Results copied to clipboard');
      }
    } catch (err) {
      console.error('Share failed:', err);
    }
  };

  return (
    <div className="bg-card rounded-xl shadow-lg border border-primary/30 p-4 space-y-4">
      <div className="text-center">
        <div className="flex items-center justify-center gap-2 mb-1">
          <span className="text-2xl">6️⃣</span>
          <h2 className="text-xl font-bold text-foreground">Stockton 6's Final</h2>
        </div>
        <p className="text-sm text-muted-foreground">{round.course.name}</p>
      </div>

      {/* Validation status */}
      <div className={`flex items-center justify-center gap-2 py-2 px-4 rounded-lg ${
        isBalanced ? 'bg-green-500/10 text-green-600' : 'bg-yellow-500/10 text-yellow-600'
      }`}>
        {isBalanced ? (
          <>
            <CheckCircle className="w-5 h-5" />
            <span className="font-medium">Totals Balanced ✓</span>
          </>
        ) : (
          <>
            <AlertTriangle className="w-5 h-5" />
            <span className="font-medium">Check Results ⚠️</span>
          </>
        )}
      </div>

      {/* Results table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 px-1 font-bold text-foreground">Player</th>
              <th className="text-center py-2 px-1 font-bold text-muted-foreground">S1</th>
              <th className="text-center py-2 px-1 font-bold text-muted-foreground">S2</th>
              <th className="text-center py-2 px-1 font-bold text-muted-foreground">S3</th>
              <th className="text-right py-2 px-1 font-bold text-foreground">Total</th>
            </tr>
          </thead>
          <tbody>
            {sortedPlayers.map((player, index) => {
              const s1 = getStretchResult(player.id, 1);
              const s2 = getStretchResult(player.id, 2);
              const s3 = getStretchResult(player.id, 3);
              const total = result.playerResults[player.id] || 0;
              
              const formatAmount = (amt: number) => {
                if (amt === 0) return '$0';
                return amt > 0 ? `+$${amt}` : `-$${Math.abs(amt)}`;
              };
              
              const getAmountColor = (amt: number) => {
                if (amt > 0) return 'text-green-500';
                if (amt < 0) return 'text-red-500';
                return 'text-muted-foreground';
              };
              
              return (
                <tr 
                  key={player.id} 
                  className={`border-b border-border/50 ${
                    index === 0 ? 'bg-yellow-500/5' : ''
                  }`}
                >
                  <td className="py-3 px-1">
                    <div className="flex items-center gap-2">
                      {index === 0 && <Trophy className="w-4 h-4 text-yellow-500" />}
                      {total < 0 && index === sortedPlayers.length - 1 && (
                        <TrendingDown className="w-4 h-4 text-red-500" />
                      )}
                      <span className="font-medium text-foreground">{player.name}</span>
                    </div>
                  </td>
                  <td className={`text-center py-3 px-1 font-mono ${getAmountColor(s1)}`}>
                    {formatAmount(s1)}
                  </td>
                  <td className={`text-center py-3 px-1 font-mono ${getAmountColor(s2)}`}>
                    {formatAmount(s2)}
                  </td>
                  <td className={`text-center py-3 px-1 font-mono ${getAmountColor(s3)}`}>
                    {formatAmount(s3)}
                  </td>
                  <td className={`text-right py-3 px-1 font-mono font-bold text-lg ${getAmountColor(total)}`}>
                    {formatAmount(total)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Share button */}
      <Button onClick={handleShare} className="w-full gap-2">
        <Share className="w-4 h-4" />
        Share Results
      </Button>
    </div>
  );
};

export default Stockton6RoundSummary;
