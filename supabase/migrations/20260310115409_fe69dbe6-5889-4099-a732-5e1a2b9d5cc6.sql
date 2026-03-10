ALTER TABLE public.tournament_group_players
  DROP CONSTRAINT tournament_group_players_team_id_fkey;

ALTER TABLE public.tournament_group_players
  ADD CONSTRAINT tournament_group_players_team_id_fkey
  FOREIGN KEY (team_id) REFERENCES public.tournament_teams(id)
  ON DELETE CASCADE;