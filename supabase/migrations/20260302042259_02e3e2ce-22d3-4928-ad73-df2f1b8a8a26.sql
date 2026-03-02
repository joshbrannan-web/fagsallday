
-- ============================================================
-- TOURNAMENT MODE — PIECE 1: DATABASE SCHEMA
-- Drop old empty tournament tables, enums, functions, then create new schema
-- ============================================================

-- 1. Drop old tables (cascade drops their policies, indexes, FK constraints)
DROP TABLE IF EXISTS tournament_rounds CASCADE;
DROP TABLE IF EXISTS tournament_players CASCADE;
DROP TABLE IF EXISTS tournaments CASCADE;

-- 2. Drop old enums
DROP TYPE IF EXISTS tournament_status CASCADE;
DROP TYPE IF EXISTS tournament_scoring_mode CASCADE;
DROP TYPE IF EXISTS tournament_player_role CASCADE;
DROP TYPE IF EXISTS tournament_round_status CASCADE;

-- 3. Drop old functions
DROP FUNCTION IF EXISTS is_tournament_creator(uuid);
DROP FUNCTION IF EXISTS is_tournament_participant(uuid);
DROP FUNCTION IF EXISTS is_round_scorekeeper(uuid);

-- ============================================================
-- CREATE 13 NEW TABLES
-- ============================================================

-- 1. tournament_admins
CREATE TABLE tournament_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  granted_by UUID REFERENCES profiles(id),
  granted_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- 2. tournaments
CREATE TABLE tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID REFERENCES profiles(id) NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'setup',
  join_code TEXT UNIQUE NOT NULL DEFAULT generate_join_code(),
  num_rounds INTEGER NOT NULL DEFAULT 2,
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. tournament_teams
CREATE TABLE tournament_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. tournament_players
CREATE TABLE tournament_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id),
  display_name TEXT NOT NULL,
  handicap_index NUMERIC(4,1) NOT NULL DEFAULT 0,
  handicap_override NUMERIC(4,1),
  team_id UUID REFERENCES tournament_teams(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tournament_id, user_id)
);

-- 5. tournament_rounds
CREATE TABLE tournament_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE NOT NULL,
  round_number INTEGER NOT NULL,
  name TEXT,
  course_data JSONB NOT NULL,
  round_date DATE,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tournament_id, round_number)
);

-- 6. tournament_games
CREATE TABLE tournament_games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_round_id UUID REFERENCES tournament_rounds(id) ON DELETE CASCADE NOT NULL UNIQUE,
  game_type TEXT NOT NULL,
  default_points_per_hole NUMERIC(4,1) NOT NULL DEFAULT 1,
  halved_hole_rule TEXT NOT NULL DEFAULT 'half_point',
  second_ball_tiebreaker BOOLEAN DEFAULT false,
  use_handicaps BOOLEAN DEFAULT true,
  handicap_allowance_percent INTEGER DEFAULT 100,
  max_score_per_hole INTEGER,
  sixes_config JSONB,
  rules_text TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. tournament_hole_points
CREATE TABLE tournament_hole_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_game_id UUID REFERENCES tournament_games(id) ON DELETE CASCADE NOT NULL,
  hole_number INTEGER NOT NULL CHECK (hole_number BETWEEN 1 AND 18),
  points NUMERIC(4,1) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tournament_game_id, hole_number)
);

-- 8. tournament_groups
CREATE TABLE tournament_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_round_id UUID REFERENCES tournament_rounds(id) ON DELETE CASCADE NOT NULL,
  group_number INTEGER NOT NULL,
  team_matchup JSONB,
  round_id UUID REFERENCES rounds(id),
  status TEXT NOT NULL DEFAULT 'pending',
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 9. tournament_group_players
CREATE TABLE tournament_group_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_group_id UUID REFERENCES tournament_groups(id) ON DELETE CASCADE NOT NULL,
  tournament_player_id UUID REFERENCES tournament_players(id) ON DELETE CASCADE NOT NULL,
  team_id UUID REFERENCES tournament_teams(id) NOT NULL,
  UNIQUE(tournament_group_id, tournament_player_id)
);

-- 10. tournament_hole_scores
CREATE TABLE tournament_hole_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_group_id UUID REFERENCES tournament_groups(id) ON DELETE CASCADE NOT NULL,
  tournament_player_id UUID REFERENCES tournament_players(id) ON DELETE CASCADE NOT NULL,
  hole_number INTEGER NOT NULL CHECK (hole_number BETWEEN 1 AND 18),
  gross_score INTEGER,
  is_super_user_override BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tournament_group_id, tournament_player_id, hole_number)
);

-- 11. tournament_hole_results
CREATE TABLE tournament_hole_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_group_id UUID REFERENCES tournament_groups(id) ON DELETE CASCADE NOT NULL,
  hole_number INTEGER NOT NULL CHECK (hole_number BETWEEN 1 AND 18),
  team_points JSONB NOT NULL DEFAULT '{}',
  player_points JSONB NOT NULL DEFAULT '{}',
  points_value NUMERIC(4,1) NOT NULL DEFAULT 1,
  result_label TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tournament_group_id, hole_number)
);

-- 12. tournament_scoreboards
CREATE TABLE tournament_scoreboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  scoreboard_type TEXT NOT NULL,
  show_round_breakdown BOOLEAN DEFAULT true,
  sort_direction TEXT DEFAULT 'desc',
  sort_metric TEXT NOT NULL DEFAULT 'total_points',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 13. tournament_members
CREATE TABLE tournament_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tournament_id, user_id)
);

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION is_tournament_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM tournament_admins WHERE user_id = auth.uid()
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION is_tournament_member(t_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM tournament_members
    WHERE tournament_id = t_id AND user_id = auth.uid()
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION is_tournament_creator(t_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM tournaments
    WHERE id = t_id AND created_by = auth.uid()
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- ============================================================
-- ENABLE RLS ON ALL 13 TABLES
-- ============================================================

ALTER TABLE tournament_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_hole_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_group_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_hole_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_hole_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_scoreboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_members ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- tournament_admins
CREATE POLICY "App admins can manage tournament admins"
  ON tournament_admins FOR ALL
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Anyone can see if they are a tournament admin"
  ON tournament_admins FOR SELECT
  USING (user_id = auth.uid());

-- tournaments
CREATE POLICY "Tournament admins can create tournaments"
  ON tournaments FOR INSERT
  WITH CHECK (is_tournament_admin());

CREATE POLICY "Tournament creator can update their tournaments"
  ON tournaments FOR UPDATE
  USING (created_by = auth.uid() AND is_tournament_admin());

CREATE POLICY "Members can view tournaments they joined"
  ON tournaments FOR SELECT
  USING (is_tournament_member(id) OR created_by = auth.uid());

-- Direct child tables with tournament_id
CREATE POLICY "Creator full access on tournament_teams"
  ON tournament_teams FOR ALL
  USING (is_tournament_creator(tournament_id));

CREATE POLICY "Members read access on tournament_teams"
  ON tournament_teams FOR SELECT
  USING (is_tournament_member(tournament_id));

CREATE POLICY "Creator full access on tournament_players"
  ON tournament_players FOR ALL
  USING (is_tournament_creator(tournament_id));

CREATE POLICY "Members read access on tournament_players"
  ON tournament_players FOR SELECT
  USING (is_tournament_member(tournament_id));

CREATE POLICY "Creator full access on tournament_rounds"
  ON tournament_rounds FOR ALL
  USING (is_tournament_creator(tournament_id));

CREATE POLICY "Members read access on tournament_rounds"
  ON tournament_rounds FOR SELECT
  USING (is_tournament_member(tournament_id));

CREATE POLICY "Creator full access on tournament_scoreboards"
  ON tournament_scoreboards FOR ALL
  USING (is_tournament_creator(tournament_id));

CREATE POLICY "Members read access on tournament_scoreboards"
  ON tournament_scoreboards FOR SELECT
  USING (is_tournament_member(tournament_id));

CREATE POLICY "Creator full access on tournament_members"
  ON tournament_members FOR ALL
  USING (is_tournament_creator(tournament_id));

CREATE POLICY "Members read access on tournament_members"
  ON tournament_members FOR SELECT
  USING (is_tournament_member(tournament_id));

CREATE POLICY "Authenticated users can join tournaments"
  ON tournament_members FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Join-through tables (via tournament_rounds)
CREATE POLICY "Creator full access on tournament_games"
  ON tournament_games FOR ALL
  USING (EXISTS (
    SELECT 1 FROM tournament_rounds tr
    JOIN tournaments t ON t.id = tr.tournament_id
    WHERE tr.id = tournament_round_id AND t.created_by = auth.uid()
  ));

CREATE POLICY "Members read tournament_games"
  ON tournament_games FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM tournament_rounds tr
    WHERE tr.id = tournament_round_id
    AND is_tournament_member(tr.tournament_id)
  ));

CREATE POLICY "Creator full access on tournament_hole_points"
  ON tournament_hole_points FOR ALL
  USING (EXISTS (
    SELECT 1 FROM tournament_games tg
    JOIN tournament_rounds tr ON tr.id = tg.tournament_round_id
    JOIN tournaments t ON t.id = tr.tournament_id
    WHERE tg.id = tournament_game_id AND t.created_by = auth.uid()
  ));

CREATE POLICY "Members read tournament_hole_points"
  ON tournament_hole_points FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM tournament_games tg
    JOIN tournament_rounds tr ON tr.id = tg.tournament_round_id
    WHERE tg.id = tournament_game_id
    AND is_tournament_member(tr.tournament_id)
  ));

CREATE POLICY "Creator full access on tournament_groups"
  ON tournament_groups FOR ALL
  USING (EXISTS (
    SELECT 1 FROM tournament_rounds tr
    JOIN tournaments t ON t.id = tr.tournament_id
    WHERE tr.id = tournament_round_id AND t.created_by = auth.uid()
  ));

CREATE POLICY "Members read tournament_groups"
  ON tournament_groups FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM tournament_rounds tr
    WHERE tr.id = tournament_round_id
    AND is_tournament_member(tr.tournament_id)
  ));

CREATE POLICY "Creator full access on tournament_group_players"
  ON tournament_group_players FOR ALL
  USING (EXISTS (
    SELECT 1 FROM tournament_groups tg
    JOIN tournament_rounds tr ON tr.id = tg.tournament_round_id
    JOIN tournaments t ON t.id = tr.tournament_id
    WHERE tg.id = tournament_group_id AND t.created_by = auth.uid()
  ));

CREATE POLICY "Members read tournament_group_players"
  ON tournament_group_players FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM tournament_groups tg
    JOIN tournament_rounds tr ON tr.id = tg.tournament_round_id
    WHERE tg.id = tournament_group_id
    AND is_tournament_member(tr.tournament_id)
  ));

-- tournament_hole_scores
CREATE POLICY "Group members can enter scores"
  ON tournament_hole_scores FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM tournament_group_players tgp
    JOIN tournament_groups tg ON tg.id = tgp.tournament_group_id
    JOIN tournament_rounds tr ON tr.id = tg.tournament_round_id
    JOIN tournament_members tm ON tm.tournament_id = tr.tournament_id
    WHERE tgp.tournament_group_id = tournament_hole_scores.tournament_group_id
    AND tm.user_id = auth.uid()
  ));

CREATE POLICY "Group members can update scores"
  ON tournament_hole_scores FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM tournament_group_players tgp
    JOIN tournament_groups tg ON tg.id = tgp.tournament_group_id
    JOIN tournament_rounds tr ON tr.id = tg.tournament_round_id
    JOIN tournament_members tm ON tm.tournament_id = tr.tournament_id
    WHERE tgp.tournament_group_id = tournament_hole_scores.tournament_group_id
    AND tm.user_id = auth.uid()
  ));

CREATE POLICY "Tournament creator can manage all scores"
  ON tournament_hole_scores FOR ALL
  USING (EXISTS (
    SELECT 1 FROM tournament_groups tg
    JOIN tournament_rounds tr ON tr.id = tg.tournament_round_id
    JOIN tournaments t ON t.id = tr.tournament_id
    WHERE tg.id = tournament_group_id
    AND t.created_by = auth.uid()
  ));

CREATE POLICY "Members can view all scores"
  ON tournament_hole_scores FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM tournament_groups tg
    JOIN tournament_rounds tr ON tr.id = tg.tournament_round_id
    WHERE tg.id = tournament_group_id
    AND is_tournament_member(tr.tournament_id)
  ));

-- tournament_hole_results
CREATE POLICY "Creator full access on tournament_hole_results"
  ON tournament_hole_results FOR ALL
  USING (EXISTS (
    SELECT 1 FROM tournament_groups tg
    JOIN tournament_rounds tr ON tr.id = tg.tournament_round_id
    JOIN tournaments t ON t.id = tr.tournament_id
    WHERE tg.id = tournament_group_id AND t.created_by = auth.uid()
  ));

CREATE POLICY "Members read tournament_hole_results"
  ON tournament_hole_results FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM tournament_groups tg
    JOIN tournament_rounds tr ON tr.id = tg.tournament_round_id
    WHERE tg.id = tournament_group_id
    AND is_tournament_member(tr.tournament_id)
  ));

-- ============================================================
-- REALTIME
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE tournament_hole_scores;
ALTER PUBLICATION supabase_realtime ADD TABLE tournament_hole_results;
ALTER PUBLICATION supabase_realtime ADD TABLE tournament_groups;
ALTER PUBLICATION supabase_realtime ADD TABLE tournament_rounds;

-- ============================================================
-- PERFORMANCE INDEXES
-- ============================================================

CREATE INDEX idx_tournament_players_tournament ON tournament_players(tournament_id);
CREATE INDEX idx_tournament_players_user ON tournament_players(user_id);
CREATE INDEX idx_tournament_rounds_tournament ON tournament_rounds(tournament_id);
CREATE INDEX idx_tournament_groups_round ON tournament_groups(tournament_round_id);
CREATE INDEX idx_tournament_group_players_group ON tournament_group_players(tournament_group_id);
CREATE INDEX idx_tournament_group_players_player ON tournament_group_players(tournament_player_id);
CREATE INDEX idx_tournament_hole_scores_group ON tournament_hole_scores(tournament_group_id);
CREATE INDEX idx_tournament_hole_scores_player ON tournament_hole_scores(tournament_player_id);
CREATE INDEX idx_tournament_hole_results_group ON tournament_hole_results(tournament_group_id);
CREATE INDEX idx_tournament_members_tournament ON tournament_members(tournament_id);
CREATE INDEX idx_tournament_members_user ON tournament_members(user_id);
CREATE INDEX idx_tournaments_join_code ON tournaments(join_code);
CREATE INDEX idx_tournament_teams_tournament ON tournament_teams(tournament_id);
