import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, UserPlus, Eye } from 'lucide-react';

const RoundAccess = () => {
  const { roundId } = useParams<{ roundId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const playerName = searchParams.get('player_name') || '';
  const [courseName, setCourseName] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRoundInfo = async () => {
      if (!roundId) return;
      try {
        const { data } = await supabase.functions.invoke('get-public-round', {
          body: { round_id: roundId },
        });
        if (data?.course?.name) {
          setCourseName(data.course.name);
        }
      } catch (e) {
        console.error('Failed to fetch round info:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchRoundInfo();
  }, [roundId]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">🏌️ You've Been Invited!</CardTitle>
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin mx-auto mt-2 text-muted-foreground" />
          ) : (
            <p className="text-muted-foreground mt-2">
              {playerName && <span className="font-medium text-foreground">{playerName}</span>}
              {playerName && courseName && ', '}
              {courseName && <>a round is underway at <span className="font-medium text-foreground">{courseName}</span></>}
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            className="w-full"
            size="lg"
            onClick={() =>
              navigate(`/auth?mode=signup&round_id=${roundId}&player_name=${encodeURIComponent(playerName)}`)
            }
          >
            <UserPlus className="mr-2 h-5 w-5" />
            Create Account to Get Full Access
          </Button>
          <Button
            variant="outline"
            className="w-full"
            size="lg"
            onClick={() => navigate(`/view-round/${roundId}`)}
          >
            <Eye className="mr-2 h-5 w-5" />
            View Round (Read-Only)
          </Button>
          <p className="text-xs text-muted-foreground text-center pt-2">
            Create an account to track your own scores, view game results, and access future rounds.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default RoundAccess;
