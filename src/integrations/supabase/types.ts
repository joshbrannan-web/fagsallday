export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      pending_round_links: {
        Row: {
          claimed_by: string | null
          created_at: string
          expires_at: string
          id: string
          owner_user_id: string
          player_name: string
          round_id: string
        }
        Insert: {
          claimed_by?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          owner_user_id: string
          player_name: string
          round_id: string
        }
        Update: {
          claimed_by?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          owner_user_id?: string
          player_name?: string
          round_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_round_links_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          ghin_last_synced: string | null
          ghin_number: string | null
          handicap_index: number | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          ghin_last_synced?: string | null
          ghin_number?: string | null
          handicap_index?: number | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          ghin_last_synced?: string | null
          ghin_number?: string | null
          handicap_index?: number | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      round_participants: {
        Row: {
          created_at: string
          id: string
          player_name: string
          round_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          player_name: string
          round_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          player_name?: string
          round_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "round_participants_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      rounds: {
        Row: {
          course_data: Json
          created_at: string
          game_data: Json
          games_data: Json
          id: string
          is_favorite: boolean
          players_data: Json
          scores: Json
          start_time: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          course_data: Json
          created_at?: string
          game_data?: Json
          games_data: Json
          id?: string
          is_favorite?: boolean
          players_data: Json
          scores?: Json
          start_time?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          course_data?: Json
          created_at?: string
          game_data?: Json
          games_data?: Json
          id?: string
          is_favorite?: boolean
          players_data?: Json
          scores?: Json
          start_time?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rounds_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_courses: {
        Row: {
          course_data: Json
          created_at: string
          id: string
          is_favorite: boolean
          user_id: string
        }
        Insert: {
          course_data: Json
          created_at?: string
          id?: string
          is_favorite?: boolean
          user_id: string
        }
        Update: {
          course_data?: Json
          created_at?: string
          id?: string
          is_favorite?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_courses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_players: {
        Row: {
          created_at: string
          handicap_index: number | null
          id: string
          linked_user_id: string | null
          name: string
          tee: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          handicap_index?: number | null
          id?: string
          linked_user_id?: string | null
          name: string
          tee?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          handicap_index?: number | null
          id?: string
          linked_user_id?: string | null
          name?: string
          tee?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_players_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_admin_requests: {
        Row: {
          id: string
          requested_at: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          id?: string
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          id?: string
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_admin_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_admin_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_admins: {
        Row: {
          granted_at: string | null
          granted_by: string | null
          id: string
          user_id: string
        }
        Insert: {
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          user_id: string
        }
        Update: {
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_admins_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_admins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_games: {
        Row: {
          created_at: string | null
          default_points_per_hole: number
          game_type: string
          halved_hole_rule: string
          handicap_allowance_percent: number | null
          id: string
          max_score_per_hole: number | null
          rules_text: string | null
          second_ball_tiebreaker: boolean | null
          sixes_config: Json | null
          sixes_format: string | null
          sixes_segment_points: Json | null
          tournament_round_id: string
          use_handicaps: boolean | null
        }
        Insert: {
          created_at?: string | null
          default_points_per_hole?: number
          game_type: string
          halved_hole_rule?: string
          handicap_allowance_percent?: number | null
          id?: string
          max_score_per_hole?: number | null
          rules_text?: string | null
          second_ball_tiebreaker?: boolean | null
          sixes_config?: Json | null
          sixes_format?: string | null
          sixes_segment_points?: Json | null
          tournament_round_id: string
          use_handicaps?: boolean | null
        }
        Update: {
          created_at?: string | null
          default_points_per_hole?: number
          game_type?: string
          halved_hole_rule?: string
          handicap_allowance_percent?: number | null
          id?: string
          max_score_per_hole?: number | null
          rules_text?: string | null
          second_ball_tiebreaker?: boolean | null
          sixes_config?: Json | null
          sixes_format?: string | null
          sixes_segment_points?: Json | null
          tournament_round_id?: string
          use_handicaps?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "tournament_games_tournament_round_id_fkey"
            columns: ["tournament_round_id"]
            isOneToOne: true
            referencedRelation: "tournament_rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_group_players: {
        Row: {
          id: string
          team_id: string
          tournament_group_id: string
          tournament_player_id: string
        }
        Insert: {
          id?: string
          team_id: string
          tournament_group_id: string
          tournament_player_id: string
        }
        Update: {
          id?: string
          team_id?: string
          tournament_group_id?: string
          tournament_player_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_group_players_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "tournament_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_group_players_tournament_group_id_fkey"
            columns: ["tournament_group_id"]
            isOneToOne: false
            referencedRelation: "tournament_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_group_players_tournament_player_id_fkey"
            columns: ["tournament_player_id"]
            isOneToOne: false
            referencedRelation: "tournament_players"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_groups: {
        Row: {
          created_at: string | null
          group_number: number
          id: string
          leader_player_id: string | null
          round_id: string | null
          status: string
          submitted_at: string | null
          team_matchup: Json | null
          tournament_round_id: string
        }
        Insert: {
          created_at?: string | null
          group_number: number
          id?: string
          leader_player_id?: string | null
          round_id?: string | null
          status?: string
          submitted_at?: string | null
          team_matchup?: Json | null
          tournament_round_id: string
        }
        Update: {
          created_at?: string | null
          group_number?: number
          id?: string
          leader_player_id?: string | null
          round_id?: string | null
          status?: string
          submitted_at?: string | null
          team_matchup?: Json | null
          tournament_round_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_groups_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_groups_tournament_round_id_fkey"
            columns: ["tournament_round_id"]
            isOneToOne: false
            referencedRelation: "tournament_rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_hole_points: {
        Row: {
          created_at: string | null
          hole_number: number
          id: string
          points: number
          tournament_game_id: string
        }
        Insert: {
          created_at?: string | null
          hole_number: number
          id?: string
          points: number
          tournament_game_id: string
        }
        Update: {
          created_at?: string | null
          hole_number?: number
          id?: string
          points?: number
          tournament_game_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_hole_points_tournament_game_id_fkey"
            columns: ["tournament_game_id"]
            isOneToOne: false
            referencedRelation: "tournament_games"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_hole_results: {
        Row: {
          hole_number: number
          id: string
          player_points: Json
          points_value: number
          result_label: string | null
          team_points: Json
          tournament_group_id: string
          updated_at: string | null
        }
        Insert: {
          hole_number: number
          id?: string
          player_points?: Json
          points_value?: number
          result_label?: string | null
          team_points?: Json
          tournament_group_id: string
          updated_at?: string | null
        }
        Update: {
          hole_number?: number
          id?: string
          player_points?: Json
          points_value?: number
          result_label?: string | null
          team_points?: Json
          tournament_group_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tournament_hole_results_tournament_group_id_fkey"
            columns: ["tournament_group_id"]
            isOneToOne: false
            referencedRelation: "tournament_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_hole_scores: {
        Row: {
          gross_score: number | null
          hole_number: number
          id: string
          is_super_user_override: boolean | null
          tournament_group_id: string
          tournament_player_id: string
          updated_at: string | null
        }
        Insert: {
          gross_score?: number | null
          hole_number: number
          id?: string
          is_super_user_override?: boolean | null
          tournament_group_id: string
          tournament_player_id: string
          updated_at?: string | null
        }
        Update: {
          gross_score?: number | null
          hole_number?: number
          id?: string
          is_super_user_override?: boolean | null
          tournament_group_id?: string
          tournament_player_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tournament_hole_scores_tournament_group_id_fkey"
            columns: ["tournament_group_id"]
            isOneToOne: false
            referencedRelation: "tournament_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_hole_scores_tournament_player_id_fkey"
            columns: ["tournament_player_id"]
            isOneToOne: false
            referencedRelation: "tournament_players"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_members: {
        Row: {
          id: string
          joined_at: string | null
          tournament_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string | null
          tournament_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string | null
          tournament_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_members_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_players: {
        Row: {
          created_at: string | null
          display_name: string
          handicap_index: number
          handicap_override: number | null
          id: string
          team_id: string | null
          tournament_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          display_name: string
          handicap_index?: number
          handicap_override?: number | null
          id?: string
          team_id?: string | null
          tournament_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          display_name?: string
          handicap_index?: number
          handicap_override?: number | null
          id?: string
          team_id?: string | null
          tournament_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tournament_players_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "tournament_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_players_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_players_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_registration_configs: {
        Row: {
          amount: number
          amount_label: string
          created_at: string
          created_by: string
          description: string | null
          event_dates: string
          google_refresh_token: string | null
          google_sheet_id: string | null
          google_sheet_url: string | null
          google_token_expires_at: string | null
          id: string
          is_open: boolean
          location: string
          name: string
          share_code: string
          tournament_id: string | null
          venmo_link: string
        }
        Insert: {
          amount?: number
          amount_label?: string
          created_at?: string
          created_by: string
          description?: string | null
          event_dates?: string
          google_refresh_token?: string | null
          google_sheet_id?: string | null
          google_sheet_url?: string | null
          google_token_expires_at?: string | null
          id?: string
          is_open?: boolean
          location?: string
          name: string
          share_code?: string
          tournament_id?: string | null
          venmo_link?: string
        }
        Update: {
          amount?: number
          amount_label?: string
          created_at?: string
          created_by?: string
          description?: string | null
          event_dates?: string
          google_refresh_token?: string | null
          google_sheet_id?: string | null
          google_sheet_url?: string | null
          google_token_expires_at?: string | null
          id?: string
          is_open?: boolean
          location?: string
          name?: string
          share_code?: string
          tournament_id?: string | null
          venmo_link?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_registration_configs_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_registration_entries: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          config_id: string
          created_at: string
          email: string
          full_name: string
          ghin_number: string | null
          handicap_index: number | null
          id: string
          notes: string | null
          payment_amount: number | null
          payment_confirmed: boolean
          phone: string | null
          sheet_row_index: number | null
          status: string
          user_id: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          config_id: string
          created_at?: string
          email: string
          full_name: string
          ghin_number?: string | null
          handicap_index?: number | null
          id?: string
          notes?: string | null
          payment_amount?: number | null
          payment_confirmed?: boolean
          phone?: string | null
          sheet_row_index?: number | null
          status?: string
          user_id?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          config_id?: string
          created_at?: string
          email?: string
          full_name?: string
          ghin_number?: string | null
          handicap_index?: number | null
          id?: string
          notes?: string | null
          payment_amount?: number | null
          payment_confirmed?: boolean
          phone?: string | null
          sheet_row_index?: number | null
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tournament_registration_entries_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "tournament_registration_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_rounds: {
        Row: {
          course_data: Json
          created_at: string | null
          id: string
          name: string | null
          notes: string | null
          round_date: string | null
          round_number: number
          status: string
          tournament_id: string
          updated_at: string | null
        }
        Insert: {
          course_data: Json
          created_at?: string | null
          id?: string
          name?: string | null
          notes?: string | null
          round_date?: string | null
          round_number: number
          status?: string
          tournament_id: string
          updated_at?: string | null
        }
        Update: {
          course_data?: Json
          created_at?: string | null
          id?: string
          name?: string | null
          notes?: string | null
          round_date?: string | null
          round_number?: number
          status?: string
          tournament_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tournament_rounds_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_scoreboards: {
        Row: {
          created_at: string | null
          display_order: number | null
          id: string
          name: string
          scoreboard_type: string
          show_round_breakdown: boolean | null
          sort_direction: string | null
          sort_metric: string
          tournament_id: string
        }
        Insert: {
          created_at?: string | null
          display_order?: number | null
          id?: string
          name: string
          scoreboard_type: string
          show_round_breakdown?: boolean | null
          sort_direction?: string | null
          sort_metric?: string
          tournament_id: string
        }
        Update: {
          created_at?: string | null
          display_order?: number | null
          id?: string
          name?: string
          scoreboard_type?: string
          show_round_breakdown?: boolean | null
          sort_direction?: string | null
          sort_metric?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_scoreboards_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_teams: {
        Row: {
          color: string
          created_at: string | null
          display_order: number | null
          id: string
          name: string
          tournament_id: string
        }
        Insert: {
          color: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          name: string
          tournament_id: string
        }
        Update: {
          color?: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          name?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_teams_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournaments: {
        Row: {
          created_at: string | null
          created_by: string
          custom_round_points: number | null
          description: string | null
          end_date: string | null
          id: string
          join_code: string
          name: string
          num_rounds: number
          start_date: string | null
          status: string
          team_scoring_method: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          custom_round_points?: number | null
          description?: string | null
          end_date?: string | null
          id?: string
          join_code?: string
          name: string
          num_rounds?: number
          start_date?: string | null
          status?: string
          team_scoring_method?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          custom_round_points?: number | null
          description?: string | null
          end_date?: string | null
          id?: string
          join_code?: string
          name?: string
          num_rounds?: number
          start_date?: string | null
          status?: string
          team_scoring_method?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tournaments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      verified_courses: {
        Row: {
          course_data: Json
          course_location: string
          course_name: string
          id: string
          total_par: number
          total_yardage: number
          verified_at: string
          verified_by: string
        }
        Insert: {
          course_data: Json
          course_location?: string
          course_name: string
          id?: string
          total_par?: number
          total_yardage?: number
          verified_at?: string
          verified_by: string
        }
        Update: {
          course_data?: Json
          course_location?: string
          course_name?: string
          id?: string
          total_par?: number
          total_yardage?: number
          verified_at?: string
          verified_by?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_user_has_role: {
        Args: { _role: Database["public"]["Enums"]["app_role"] }
        Returns: boolean
      }
      decrement_sheet_row_index: {
        Args: { p_above_row: number; p_config_id: string }
        Returns: undefined
      }
      generate_join_code: { Args: never; Returns: string }
      generate_registration_share_code: { Args: never; Returns: string }
      get_saved_players_with_profiles: {
        Args: { p_user_id: string }
        Returns: {
          created_at: string
          ghin_last_synced: string
          ghin_number: string
          handicap_index: number
          id: string
          linked_user_id: string
          name: string
          tee: string
          updated_at: string
          user_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_group_member: { Args: { _group_id: string }; Returns: boolean }
      is_round_owner: { Args: { _round_id: string }; Returns: boolean }
      is_tournament_admin: { Args: never; Returns: boolean }
      is_tournament_creator: { Args: { t_id: string }; Returns: boolean }
      is_tournament_member: { Args: { t_id: string }; Returns: boolean }
      link_players_bidirectional: {
        Args: { p_linked_user_id: string }
        Returns: undefined
      }
      patch_round_game_data: {
        Args: {
          p_game_id: string
          p_hole: number
          p_round_id: string
          p_updates: Json
        }
        Returns: undefined
      }
      patch_round_scores: {
        Args: {
          p_hole: number
          p_player_id: string
          p_round_id: string
          p_score: number
        }
        Returns: undefined
      }
      search_users_by_name: {
        Args: { search_term: string }
        Returns: {
          display_name: string
          handicap_index: number
          id: string
        }[]
      }
      seed_service_role_secret: {
        Args: { p_value: string }
        Returns: undefined
      }
      unlink_players_bidirectional: {
        Args: { p_linked_user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
