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
      contact_messages: {
        Row: {
          budget: string | null
          created_at: string
          email: string
          id: string
          ip: string | null
          message: string
          name: string
          project_type: string | null
          source: string
          status: string
          subject: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          budget?: string | null
          created_at?: string
          email: string
          id?: string
          ip?: string | null
          message: string
          name: string
          project_type?: string | null
          source?: string
          status?: string
          subject?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          budget?: string | null
          created_at?: string
          email?: string
          id?: string
          ip?: string | null
          message?: string
          name?: string
          project_type?: string | null
          source?: string
          status?: string
          subject?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      contact_requests: {
        Row: {
          budget: string
          created_at: string
          email: string
          id: string
          ip: string | null
          message: string
          name: string
          project_type: string
          source: string
          status: string
          user_agent: string | null
        }
        Insert: {
          budget: string
          created_at?: string
          email: string
          id?: string
          ip?: string | null
          message: string
          name: string
          project_type: string
          source?: string
          status?: string
          user_agent?: string | null
        }
        Update: {
          budget?: string
          created_at?: string
          email?: string
          id?: string
          ip?: string | null
          message?: string
          name?: string
          project_type?: string
          source?: string
          status?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      leaderboard_daily_best: {
        Row: {
          created_at: string
          date: string
          game_slug: string
          id: number
          player_name: string | null
          score: number
          source_score_id: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          date: string
          game_slug: string
          id?: never
          player_name?: string | null
          score: number
          source_score_id?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          game_slug?: string
          id?: never
          player_name?: string | null
          score?: number
          source_score_id?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leaderboard_daily_best_source_score_id_fkey"
            columns: ["source_score_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_scores"
            referencedColumns: ["id"]
          },
        ]
      }
      leaderboard_scores: {
        Row: {
          created_at: string
          game_slug: string
          id: number
          player_name: string | null
          score: number
          user_id: string
        }
        Insert: {
          created_at?: string
          game_slug: string
          id?: number
          player_name?: string | null
          score: number
          user_id: string
        }
        Update: {
          created_at?: string
          game_slug?: string
          id?: number
          player_name?: string | null
          score?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leaderboard_scores_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      leaderboard_weekly_best: {
        Row: {
          created_at: string
          game_slug: string
          id: number
          player_name: string | null
          score: number
          source_score_id: number | null
          user_id: string
          week_end: string
          week_start: string
        }
        Insert: {
          created_at?: string
          game_slug: string
          id?: never
          player_name?: string | null
          score: number
          source_score_id?: number | null
          user_id: string
          week_end: string
          week_start: string
        }
        Update: {
          created_at?: string
          game_slug?: string
          id?: never
          player_name?: string | null
          score?: number
          source_score_id?: number | null
          user_id?: string
          week_end?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "leaderboard_weekly_best_source_score_id_fkey"
            columns: ["source_score_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_scores"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          display_name: string
          phone: string | null
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          display_name: string
          phone?: string | null
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          display_name?: string
          phone?: string | null
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      services: {
        Row: {
          created_at: string
          deliverables: string[]
          faq: Json
          id: string
          is_active: boolean
          process_steps: string[]
          slug: string
          sort_order: number
          timeline: string | null
          title: string
          updated_at: string
          value_prop: string
        }
        Insert: {
          created_at?: string
          deliverables?: string[]
          faq?: Json
          id?: string
          is_active?: boolean
          process_steps?: string[]
          slug: string
          sort_order?: number
          timeline?: string | null
          title: string
          updated_at?: string
          value_prop: string
        }
        Update: {
          created_at?: string
          deliverables?: string[]
          faq?: Json
          id?: string
          is_active?: boolean
          process_steps?: string[]
          slug?: string
          sort_order?: number
          timeline?: string | null
          title?: string
          updated_at?: string
          value_prop?: string
        }
        Relationships: []
      }
      subscription_plans: {
        Row: {
          code: string
          created_at: string
          duration_days: number
          id: string
          is_active: boolean
          price_bdt: number
          title: string
        }
        Insert: {
          code: string
          created_at?: string
          duration_days: number
          id?: string
          is_active?: boolean
          price_bdt: number
          title: string
        }
        Update: {
          code?: string
          created_at?: string
          duration_days?: number
          id?: string
          is_active?: boolean
          price_bdt?: number
          title?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          amount_bdt: number
          created_at: string
          currency: string
          ends_at: string
          id: string
          plan_id: string
          provider: string | null
          provider_ref: string | null
          starts_at: string
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount_bdt: number
          created_at?: string
          currency?: string
          ends_at: string
          id?: string
          plan_id: string
          provider?: string | null
          provider_ref?: string | null
          starts_at?: string
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount_bdt?: number
          created_at?: string
          currency?: string
          ends_at?: string
          id?: string
          plan_id?: string
          provider?: string | null
          provider_ref?: string | null
          starts_at?: string
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_scores: {
        Row: {
          created_at: string
          id: string
          player_name: string
          score: number
          tournament_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          player_name: string
          score: number
          tournament_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          player_name?: string
          score?: number
          tournament_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_scores_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_winners: {
        Row: {
          created_at: string
          id: string
          player_name: string
          prize: string | null
          prize_bdt: number | null
          prize_label: string | null
          rank: number
          score: number
          tournament_id: string | null
          tournament_slug: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          player_name: string
          prize?: string | null
          prize_bdt?: number | null
          prize_label?: string | null
          rank: number
          score: number
          tournament_id?: string | null
          tournament_slug: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          player_name?: string
          prize?: string | null
          prize_bdt?: number | null
          prize_label?: string | null
          rank?: number
          score?: number
          tournament_id?: string | null
          tournament_slug?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tournament_winners_tournament_id_fkey"
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
          description: string | null
          ends_at: string
          finalized: boolean
          game_slug: string
          id: string
          prize: string | null
          prize_1: string | null
          prize_2: string | null
          prize_3: string | null
          slug: string
          starts_at: string
          status: string
          thumbnail_path: string | null
          thumbnail_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          ends_at: string
          finalized?: boolean
          game_slug: string
          id?: string
          prize?: string | null
          prize_1?: string | null
          prize_2?: string | null
          prize_3?: string | null
          slug: string
          starts_at: string
          status?: string
          thumbnail_path?: string | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          ends_at?: string
          finalized?: boolean
          game_slug?: string
          id?: string
          prize?: string | null
          prize_1?: string | null
          prize_2?: string | null
          prize_3?: string | null
          slug?: string
          starts_at?: string
          status?: string
          thumbnail_path?: string | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      work_media: {
        Row: {
          alt: string | null
          created_at: string | null
          id: string
          kind: string
          path: string
          sort_order: number | null
          work_id: string
        }
        Insert: {
          alt?: string | null
          created_at?: string | null
          id?: string
          kind: string
          path: string
          sort_order?: number | null
          work_id: string
        }
        Update: {
          alt?: string | null
          created_at?: string | null
          id?: string
          kind?: string
          path?: string
          sort_order?: number | null
          work_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_media_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "works"
            referencedColumns: ["id"]
          },
        ]
      }
      works: {
        Row: {
          category: string
          created_at: string | null
          cta: string | null
          highlights: string[] | null
          id: string
          is_active: boolean | null
          outcome: string | null
          role: string | null
          short_description: string | null
          slug: string
          sort_order: number | null
          tags: string[] | null
          title: string
          tools: string[] | null
          updated_at: string | null
          year: number | null
        }
        Insert: {
          category: string
          created_at?: string | null
          cta?: string | null
          highlights?: string[] | null
          id?: string
          is_active?: boolean | null
          outcome?: string | null
          role?: string | null
          short_description?: string | null
          slug: string
          sort_order?: number | null
          tags?: string[] | null
          title: string
          tools?: string[] | null
          updated_at?: string | null
          year?: number | null
        }
        Update: {
          category?: string
          created_at?: string | null
          cta?: string | null
          highlights?: string[] | null
          id?: string
          is_active?: boolean | null
          outcome?: string | null
          role?: string | null
          short_description?: string | null
          slug?: string
          sort_order?: number | null
          tags?: string[] | null
          title?: string
          tools?: string[] | null
          updated_at?: string | null
          year?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      activate_dummy_subscription: {
        Args: { p_plan_code: string }
        Returns: Json
      }
      compute_daily_winners: { Args: { run_date: string }; Returns: undefined }
      compute_weekly_winners: {
        Args: { week_start: string }
        Returns: undefined
      }
      end_live_tournaments: { Args: never; Returns: undefined }
      finalize_due_tournaments: { Args: never; Returns: number }
      finalize_ended_tournaments: { Args: never; Returns: undefined }
      finalize_tournament_winners:
        | {
            Args: { p_force?: boolean; p_tournament_id: string }
            Returns: number
          }
        | { Args: { p_tournament_slug: string }; Returns: Json }
      finalize_tournament_winners_by_id: {
        Args: { p_tournament_id: string }
        Returns: Json
      }
      gen_unique_display_name: { Args: never; Returns: string }
      generate_unique_display_name: { Args: never; Returns: string }
      get_alltime_best: {
        Args: { p_game_slug: string; p_limit?: number }
        Returns: {
          best_score: number
          last_at: string
          player_name: string
          user_id: string
        }[]
      }
      get_daily_best: {
        Args: { p_game_slug: string; p_limit?: number }
        Returns: {
          best_score: number
          last_at: string
          player_name: string
          user_id: string
        }[]
      }
      get_game_leaderboard_period: {
        Args: { p_game_slug: string; p_limit?: number; p_period: string }
        Returns: {
          achieved_at: string
          best_score: number
          player_name: string
          user_id: string
        }[]
      }
      get_game_winners: {
        Args: { p_game_slug: string; p_limit?: number }
        Returns: {
          achieved_at: string
          best_score: number
          player_name: string
          user_id: string
        }[]
      }
      get_weekly_best: {
        Args: { p_game_slug: string; p_limit?: number }
        Returns: {
          best_score: number
          last_at: string
          player_name: string
          user_id: string
        }[]
      }
      has_active_subscription: { Args: { p_user_id: string }; Returns: boolean }
      is_admin:
        | { Args: never; Returns: boolean }
        | { Args: { uid: string }; Returns: boolean }
      leaderboard_best_alltime: {
        Args: { p_game_slug: string; p_limit?: number }
        Returns: {
          created_at: string
          game_slug: string
          id: number
          player_name: string
          score: number
          user_id: string
        }[]
      }
      leaderboard_best_period: {
        Args: { p_game_slug: string; p_limit?: number; p_period: string }
        Returns: {
          created_at: string
          game_slug: string
          id: number
          player_name: string
          score: number
          user_id: string
        }[]
      }
      make_random_display_name: { Args: never; Returns: string }
      phone_exists: { Args: { p: string }; Returns: boolean }
      refresh_score_snapshots: {
        Args: { day: string; week_start: string }
        Returns: undefined
      }
      start_scheduled_tournaments: { Args: never; Returns: undefined }
      tournaments_tick: { Args: never; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
