ALTER TABLE tournament_games
  ADD COLUMN IF NOT EXISTS sixes_format TEXT DEFAULT 'match_play',
  ADD COLUMN IF NOT EXISTS sixes_segment_points JSONB DEFAULT '[1,1,1]';