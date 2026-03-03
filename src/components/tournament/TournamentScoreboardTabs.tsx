import React from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Trophy } from 'lucide-react';

interface ScoreboardConfig {
  id: string;
  name: string;
  scoreboard_type: string;
  display_order: number | null;
}

interface Props {
  scoreboards: ScoreboardConfig[];
}

const TournamentScoreboardTabs: React.FC<Props> = ({ scoreboards }) => {
  if (scoreboards.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          <Trophy className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No scoreboards configured yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Tabs defaultValue={scoreboards[0]?.id}>
      <TabsList className="w-full overflow-x-auto justify-start">
        {scoreboards.map(sb => (
          <TabsTrigger key={sb.id} value={sb.id} className="text-xs">
            {sb.name}
          </TabsTrigger>
        ))}
      </TabsList>
      {scoreboards.map(sb => (
        <TabsContent key={sb.id} value={sb.id}>
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              <p className="font-semibold mb-1">{sb.name}</p>
              <p className="text-sm">Live scoreboards coming in a future update.</p>
            </CardContent>
          </Card>
        </TabsContent>
      ))}
    </Tabs>
  );
};

export default TournamentScoreboardTabs;
