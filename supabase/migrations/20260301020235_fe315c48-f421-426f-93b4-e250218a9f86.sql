
-- Create tournament status type
CREATE TYPE public.tournament_status AS ENUM ('SETUP', 'ACTIVE', 'COMPLETE');
CREATE TYPE public.tournament_scoring_mode AS ENUM ('stroke_play', 'points');
CREATE TYPE public.tournament_player_role AS ENUM ('super_user', 'scorekeeper', 'player');
CREATE TYPE public.tournament_round_status AS ENUM ('SETUP', 'ACTIVE', 'COMPLETE');

-- Generate random join code function
CREATE OR REPLACE FUNCTION public.generate_join_code()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  code text;
  exists_already boolean;
BEGIN
  LOOP
    code := upper(substr(md5(random()::text), 1, 6));
    SELECT EXISTS (SELECT 1 FROM public.tournaments WHERE join_code = code) INTO exists_already;
    EXIT WHEN NOT exists_already;
  END LOOP;
  RETURN code;
END;
$$;

-- Tournaments table
CREATE TABLE public.tournaments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL,
  name text NOT NULL,
  join_code text UNIQUE NOT NULL DEFAULT public.generate_join_code(),
  scoring_mode public.tournament_scoring_mode NOT NULL DEFAULT 'points',
  max_players integer NOT NULL DEFAULT 50,
  status public.tournament_status NOT NULL DEFAULT 'SETUP',
  settings jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;

-- Tournament players table
CREATE TABLE public.tournament_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  user_id uuid,
  player_name text NOT NULL,
  handicap_index numeric NOT NULL DEFAULT 0,
  role public.tournament_player_role NOT NULL DEFAULT 'player',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tournament_players ENABLE ROW LEVEL SECURITY;

-- Tournament rounds table
CREATE TABLE public.tournament_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  round_number integer NOT NULL,
  course_data jsonb NOT NULL DEFAULT '{}',
  teams_data jsonb NOT NULL DEFAULT '[]',
  games_data jsonb NOT NULL DEFAULT '[]',
  scores jsonb NOT NULL DEFAULT '{}',
  points_data jsonb NOT NULL DEFAULT '{}',
  scorekeeper_id uuid,
  status public.tournament_round_status NOT NULL DEFAULT 'SETUP',
  start_time timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tournament_rounds ENABLE ROW LEVEL SECURITY;

-- Enable realtime for tournament_rounds (live leaderboard)
ALTER PUBLICATION supabase_realtime ADD TABLE public.tournament_rounds;

-- Helper function: is tournament creator
CREATE OR REPLACE FUNCTION public.is_tournament_creator(_tournament_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tournaments
    WHERE id = _tournament_id AND creator_id = auth.uid()
  );
$$;

-- Helper function: is tournament participant
CREATE OR REPLACE FUNCTION public.is_tournament_participant(_tournament_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tournament_players
    WHERE tournament_id = _tournament_id AND user_id = auth.uid()
  );
$$;

-- Helper function: is scorekeeper for a round
CREATE OR REPLACE FUNCTION public.is_round_scorekeeper(_round_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tournament_rounds
    WHERE id = _round_id AND scorekeeper_id = auth.uid()
  );
$$;

-- RLS: tournaments
CREATE POLICY "Creator can do everything on own tournaments"
ON public.tournaments FOR ALL
TO authenticated
USING (auth.uid() = creator_id)
WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Participants can view tournaments"
ON public.tournaments FOR SELECT
TO authenticated
USING (is_tournament_participant(id));

-- RLS: tournament_players
CREATE POLICY "Creator can manage players"
ON public.tournament_players FOR ALL
TO authenticated
USING (is_tournament_creator(tournament_id))
WITH CHECK (is_tournament_creator(tournament_id));

CREATE POLICY "Players can view tournament roster"
ON public.tournament_players FOR SELECT
TO authenticated
USING (is_tournament_participant(tournament_id));

CREATE POLICY "Users can join tournaments"
ON public.tournament_players FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- RLS: tournament_rounds
CREATE POLICY "Creator can manage rounds"
ON public.tournament_rounds FOR ALL
TO authenticated
USING (is_tournament_creator(tournament_id))
WITH CHECK (is_tournament_creator(tournament_id));

CREATE POLICY "Participants can view rounds"
ON public.tournament_rounds FOR SELECT
TO authenticated
USING (is_tournament_participant(tournament_id));

CREATE POLICY "Scorekeeper can update scores"
ON public.tournament_rounds FOR UPDATE
TO authenticated
USING (is_round_scorekeeper(id));

-- Updated_at triggers
CREATE TRIGGER update_tournaments_updated_at
  BEFORE UPDATE ON public.tournaments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tournament_rounds_updated_at
  BEFORE UPDATE ON public.tournament_rounds
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
