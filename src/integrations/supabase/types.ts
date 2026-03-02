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
      tournament_players: {
        Row: {
          created_at: string
          handicap_index: number
          id: string
          player_name: string
          role: Database["public"]["Enums"]["tournament_player_role"]
          tournament_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          handicap_index?: number
          id?: string
          player_name: string
          role?: Database["public"]["Enums"]["tournament_player_role"]
          tournament_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          handicap_index?: number
          id?: string
          player_name?: string
          role?: Database["public"]["Enums"]["tournament_player_role"]
          tournament_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tournament_players_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_rounds: {
        Row: {
          course_data: Json
          created_at: string
          games_data: Json
          id: string
          points_data: Json
          round_number: number
          scorekeeper_id: string | null
          scores: Json
          start_time: string | null
          status: Database["public"]["Enums"]["tournament_round_status"]
          teams_data: Json
          tournament_id: string
          updated_at: string
        }
        Insert: {
          course_data?: Json
          created_at?: string
          games_data?: Json
          id?: string
          points_data?: Json
          round_number: number
          scorekeeper_id?: string | null
          scores?: Json
          start_time?: string | null
          status?: Database["public"]["Enums"]["tournament_round_status"]
          teams_data?: Json
          tournament_id: string
          updated_at?: string
        }
        Update: {
          course_data?: Json
          created_at?: string
          games_data?: Json
          id?: string
          points_data?: Json
          round_number?: number
          scorekeeper_id?: string | null
          scores?: Json
          start_time?: string | null
          status?: Database["public"]["Enums"]["tournament_round_status"]
          teams_data?: Json
          tournament_id?: string
          updated_at?: string
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
      tournaments: {
        Row: {
          created_at: string
          creator_id: string
          id: string
          join_code: string
          max_players: number
          name: string
          scoring_mode: Database["public"]["Enums"]["tournament_scoring_mode"]
          settings: Json
          status: Database["public"]["Enums"]["tournament_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          creator_id: string
          id?: string
          join_code?: string
          max_players?: number
          name: string
          scoring_mode?: Database["public"]["Enums"]["tournament_scoring_mode"]
          settings?: Json
          status?: Database["public"]["Enums"]["tournament_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          creator_id?: string
          id?: string
          join_code?: string
          max_players?: number
          name?: string
          scoring_mode?: Database["public"]["Enums"]["tournament_scoring_mode"]
          settings?: Json
          status?: Database["public"]["Enums"]["tournament_status"]
          updated_at?: string
        }
        Relationships: []
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
      generate_join_code: { Args: never; Returns: string }
      get_saved_players_with_profiles: {
        Args: { p_user_id: string }
        Returns: {
          created_at: string
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
      is_round_owner: { Args: { _round_id: string }; Returns: boolean }
      is_round_scorekeeper: { Args: { _round_id: string }; Returns: boolean }
      is_tournament_creator: {
        Args: { _tournament_id: string }
        Returns: boolean
      }
      is_tournament_participant: {
        Args: { _tournament_id: string }
        Returns: boolean
      }
      link_players_bidirectional: {
        Args: { p_linked_user_id: string }
        Returns: undefined
      }
      search_users_by_name: {
        Args: { search_term: string }
        Returns: {
          display_name: string
          id: string
        }[]
      }
      unlink_players_bidirectional: {
        Args: { p_linked_user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      tournament_player_role: "super_user" | "scorekeeper" | "player"
      tournament_round_status: "SETUP" | "ACTIVE" | "COMPLETE"
      tournament_scoring_mode: "stroke_play" | "points"
      tournament_status: "SETUP" | "ACTIVE" | "COMPLETE"
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
      tournament_player_role: ["super_user", "scorekeeper", "player"],
      tournament_round_status: ["SETUP", "ACTIVE", "COMPLETE"],
      tournament_scoring_mode: ["stroke_play", "points"],
      tournament_status: ["SETUP", "ACTIVE", "COMPLETE"],
    },
  },
} as const
