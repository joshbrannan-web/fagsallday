ALTER TABLE public.tournament_round_matches
  DROP CONSTRAINT tournament_round_matches_tournament_round_id_match_number_key;

ALTER TABLE public.tournament_round_matches
  ADD CONSTRAINT tournament_round_matches_round_test_number_key
  UNIQUE (tournament_round_id, is_test, match_number);