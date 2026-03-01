import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTournament } from '@/hooks/useTournament';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const TournamentRoundSetup: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { tournament, players, isLoading, isCreator, addRound } = useTournament(id);

  const [courseName, setCourseName] = useState('');
  const [courseLocation, setCourseLocation] = useState('');
  const [pointsPerHole, setPointsPerHole] = useState('1');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!tournament || !isCreator) {
    navigate(`/tournament/${id}`);
    return null;
  }

  const handleCreate = async () => {
    if (!courseName.trim()) {
      toast.error('Enter a course name');
      return;
    }
    setIsSubmitting(true);

    const courseData = {
      name: courseName.trim(),
      location: courseLocation.trim(),
    };

    const gamesData = [{
      name: 'Points',
      pointsPerHole: parseFloat(pointsPerHole) || 1,
      type: 'custom_points',
    }];

    const round = await addRound(courseData, gamesData);
    setIsSubmitting(false);

    if (round) {
      toast.success('Round added!');
      navigate(`/tournament/${id}/round/${round.id}`);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/tournament/${id}`)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-xl font-bold text-foreground">Add Round</h1>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-foreground">Course Name *</label>
          <Input
            placeholder="e.g. Pebble Beach"
            value={courseName}
            onChange={e => setCourseName(e.target.value)}
          />
        </div>

        <div>
          <label className="text-sm font-medium text-foreground">Location</label>
          <Input
            placeholder="e.g. Monterey, CA"
            value={courseLocation}
            onChange={e => setCourseLocation(e.target.value)}
          />
        </div>

        {tournament.scoring_mode === 'points' && (
          <div>
            <label className="text-sm font-medium text-foreground">Points per Hole</label>
            <Input
              type="number"
              value={pointsPerHole}
              onChange={e => setPointsPerHole(e.target.value)}
              min={0.5}
              step={0.5}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Super user can assign custom points per player after each hole
            </p>
          </div>
        )}

        <div className="pt-4">
          <h2 className="font-semibold text-foreground mb-2">Players ({players.length})</h2>
          <div className="space-y-1">
            {players.map(p => (
              <div key={p.id} className="text-sm text-muted-foreground">
                {p.player_name} (HCP: {p.handicap_index})
              </div>
            ))}
          </div>
        </div>

        <Button onClick={handleCreate} disabled={isSubmitting} className="w-full" size="lg">
          {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Round'}
        </Button>
      </div>
    </div>
  );
};

export default TournamentRoundSetup;
