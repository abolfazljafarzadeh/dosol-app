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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      challenge_instances: {
        Row: {
          challenge_code: string
          created_at: string
          id: string
          status: string
          updated_at: string
          user_id: string | null
          window_end: string | null
          window_start: string | null
        }
        Insert: {
          challenge_code: string
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
          user_id?: string | null
          window_end?: string | null
          window_start?: string | null
        }
        Update: {
          challenge_code?: string
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
          user_id?: string | null
          window_end?: string | null
          window_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "challenge_instances_challenge_code_fkey"
            columns: ["challenge_code"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "challenge_instances_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      challenge_progress: {
        Row: {
          challenge_code: string
          completed_at: string | null
          created_at: string
          id: string
          progress: Json
          status: Database["public"]["Enums"]["challenge_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          challenge_code: string
          completed_at?: string | null
          created_at?: string
          id?: string
          progress?: Json
          status?: Database["public"]["Enums"]["challenge_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          challenge_code?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          progress?: Json
          status?: Database["public"]["Enums"]["challenge_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      challenges: {
        Row: {
          auto_enroll: boolean
          code: string
          conditions: Json
          created_at: string
          id: string
          kind: string
          period: string | null
          reward: Json | null
          status: string
          title: string
          unlock: Json | null
        }
        Insert: {
          auto_enroll?: boolean
          code: string
          conditions?: Json
          created_at?: string
          id?: string
          kind?: string
          period?: string | null
          reward?: Json | null
          status?: string
          title: string
          unlock?: Json | null
        }
        Update: {
          auto_enroll?: boolean
          code?: string
          conditions?: Json
          created_at?: string
          id?: string
          kind?: string
          period?: string | null
          reward?: Json | null
          status?: string
          title?: string
          unlock?: Json | null
        }
        Relationships: []
      }
      courses: {
        Row: {
          active: boolean
          created_at: string
          id: string
          image_url: string | null
          price: number
          summary: string | null
          title: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          image_url?: string | null
          price?: number
          summary?: string | null
          title: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          image_url?: string | null
          price?: number
          summary?: string | null
          title?: string
        }
        Relationships: []
      }
      invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          id: string
          invite_code: string
          invitee_id: string | null
          inviter_id: string
          status: Database["public"]["Enums"]["invite_status"]
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          invite_code: string
          invitee_id?: string | null
          inviter_id: string
          status?: Database["public"]["Enums"]["invite_status"]
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          invite_code?: string
          invitee_id?: string | null
          inviter_id?: string
          status?: Database["public"]["Enums"]["invite_status"]
        }
        Relationships: [
          {
            foreignKeyName: "invites_invitee_id_fkey"
            columns: ["invitee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invites_inviter_id_fkey"
            columns: ["inviter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      league_members: {
        Row: {
          created_at: string
          id: string
          league_id: string
          rank: number | null
          updated_at: string
          user_id: string
          weekly_xp: number
        }
        Insert: {
          created_at?: string
          id?: string
          league_id: string
          rank?: number | null
          updated_at?: string
          user_id: string
          weekly_xp?: number
        }
        Update: {
          created_at?: string
          id?: string
          league_id?: string
          rank?: number | null
          updated_at?: string
          user_id?: string
          weekly_xp?: number
        }
        Relationships: [
          {
            foreignKeyName: "league_members_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "weekly_leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      league_scores: {
        Row: {
          id: string
          league_id: string
          user_id: string
          xp_week: number
        }
        Insert: {
          id?: string
          league_id: string
          user_id: string
          xp_week?: number
        }
        Update: {
          id?: string
          league_id?: string
          user_id?: string
          xp_week?: number
        }
        Relationships: [
          {
            foreignKeyName: "league_scores_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "weekly_leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_scores_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      medals: {
        Row: {
          code: string
          condition: Json | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          kind: Database["public"]["Enums"]["medal_kind"]
          reward: Json | null
          title: string
        }
        Insert: {
          code: string
          condition?: Json | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          kind: Database["public"]["Enums"]["medal_kind"]
          reward?: Json | null
          title: string
        }
        Update: {
          code?: string
          condition?: Json | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          kind?: Database["public"]["Enums"]["medal_kind"]
          reward?: Json | null
          title?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          payload: Json | null
          read_at: string | null
          scheduled_at: string | null
          status: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          payload?: Json | null
          read_at?: string | null
          scheduled_at?: string | null
          status?: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          payload?: Json | null
          read_at?: string | null
          scheduled_at?: string | null
          status?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      otp_codes: {
        Row: {
          code: string
          created_at: string
          id: string
          phone: string
          verified: boolean
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          phone: string
          verified?: boolean
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          phone?: string
          verified?: boolean
        }
        Relationships: []
      }
      outbox_events: {
        Row: {
          created_at: string | null
          id: string
          payload: Json
          processed: boolean
          topic: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          payload: Json
          processed?: boolean
          topic: string
        }
        Update: {
          created_at?: string | null
          id?: string
          payload?: Json
          processed?: boolean
          topic?: string
        }
        Relationships: []
      }
      practice_logs: {
        Row: {
          created_at: string
          id: string
          idempotency_key: string | null
          local_date: string | null
          minutes: number
          note: string | null
          practiced_on: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          idempotency_key?: string | null
          local_date?: string | null
          minutes: number
          note?: string | null
          practiced_on?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          idempotency_key?: string | null
          local_date?: string | null
          minutes?: number
          note?: string | null
          practiced_on?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "practice_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          first_name: string | null
          id: string
          instrument: string | null
          is_premium: boolean
          last_name: string | null
          level: string | null
          notifications_enabled: boolean
          phone: string | null
          push_token: string | null
          subscription_expires_at: string | null
          subscription_started_at: string | null
          tz: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          first_name?: string | null
          id: string
          instrument?: string | null
          is_premium?: boolean
          last_name?: string | null
          level?: string | null
          notifications_enabled?: boolean
          phone?: string | null
          push_token?: string | null
          subscription_expires_at?: string | null
          subscription_started_at?: string | null
          tz?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          first_name?: string | null
          id?: string
          instrument?: string | null
          is_premium?: boolean
          last_name?: string | null
          level?: string | null
          notifications_enabled?: boolean
          phone?: string | null
          push_token?: string | null
          subscription_expires_at?: string | null
          subscription_started_at?: string | null
          tz?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      purchases: {
        Row: {
          amount: number
          authority: string | null
          course_id: number | null
          created_at: string
          id: string
          ref_id: string | null
          state: string | null
          status: Database["public"]["Enums"]["purchase_status"]
          transaction_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          authority?: string | null
          course_id?: number | null
          created_at?: string
          id?: string
          ref_id?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["purchase_status"]
          transaction_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          authority?: string | null
          course_id?: number | null
          created_at?: string
          id?: string
          ref_id?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["purchase_status"]
          transaction_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchases_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      streaks: {
        Row: {
          best_streak: number
          current_streak: number
          last_active_local_date: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          best_streak?: number
          current_streak?: number
          last_active_local_date?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          best_streak?: number
          current_streak?: number
          last_active_local_date?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "streaks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      training_plans: {
        Row: {
          created_at: string
          days: number[]
          id: string
          times: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          days: number[]
          id?: string
          times?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          days?: number[]
          id?: string
          times?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_plans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_challenge_progress: {
        Row: {
          claimed_at: string | null
          completed_at: string | null
          id: string
          instance_id: string
          is_claimable: boolean
          is_completed: boolean
          progress: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          claimed_at?: string | null
          completed_at?: string | null
          id?: string
          instance_id: string
          is_claimable?: boolean
          is_completed?: boolean
          progress?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          claimed_at?: string | null
          completed_at?: string | null
          id?: string
          instance_id?: string
          is_claimable?: boolean
          is_completed?: boolean
          progress?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_challenge_progress_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "challenge_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_challenge_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_medals: {
        Row: {
          earned_at: string
          id: string
          medal_id: string
          user_id: string
        }
        Insert: {
          earned_at?: string
          id?: string
          medal_id: string
          user_id: string
        }
        Update: {
          earned_at?: string
          id?: string
          medal_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_medals_medal_id_fkey"
            columns: ["medal_id"]
            isOneToOne: false
            referencedRelation: "medals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_medals_user_id_fkey"
            columns: ["user_id"]
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
          role?: Database["public"]["Enums"]["app_role"]
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
      weekly_leagues: {
        Row: {
          bucket: string | null
          bucket_tier: Database["public"]["Enums"]["bucket_tier"] | null
          capacity: number | null
          created_at: string
          end_local_week: string | null
          id: string
          member_count: number | null
          start_local_week: string | null
          status: Database["public"]["Enums"]["league_status"]
          week_end: string
          week_start: string
        }
        Insert: {
          bucket?: string | null
          bucket_tier?: Database["public"]["Enums"]["bucket_tier"] | null
          capacity?: number | null
          created_at?: string
          end_local_week?: string | null
          id?: string
          member_count?: number | null
          start_local_week?: string | null
          status?: Database["public"]["Enums"]["league_status"]
          week_end: string
          week_start: string
        }
        Update: {
          bucket?: string | null
          bucket_tier?: Database["public"]["Enums"]["bucket_tier"] | null
          capacity?: number | null
          created_at?: string
          end_local_week?: string | null
          id?: string
          member_count?: number | null
          start_local_week?: string | null
          status?: Database["public"]["Enums"]["league_status"]
          week_end?: string
          week_start?: string
        }
        Relationships: []
      }
      xp_counters: {
        Row: {
          created_at: string
          last_practice: string | null
          streak: number
          total_xp: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          last_practice?: string | null
          streak?: number
          total_xp?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          last_practice?: string | null
          streak?: number
          total_xp?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "xp_counters_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      xp_events: {
        Row: {
          created_at: string | null
          delta: number
          id: string
          local_date: string
          practice_log_id: string | null
          source: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          delta: number
          id?: string
          local_date: string
          practice_log_id?: string | null
          source: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          delta?: number
          id?: string
          local_date?: string
          practice_log_id?: string | null
          source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "xp_events_practice_log_id_fkey"
            columns: ["practice_log_id"]
            isOneToOne: false
            referencedRelation: "practice_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "xp_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_achievements: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      get_user_bucket_tier: {
        Args: { p_user_id: string }
        Returns: Database["public"]["Enums"]["bucket_tier"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_league_member: {
        Args: { _league_id: string; _user_id: string }
        Returns: boolean
      }
      is_subscription_active: {
        Args: { user_id: string }
        Returns: boolean
      }
      rpc_admin_get_app_health: {
        Args: { p_admin_id: string }
        Returns: Json
      }
      rpc_admin_get_challenges_stats: {
        Args: { p_admin_id: string }
        Returns: Json
      }
      rpc_admin_get_courses_stats: {
        Args: { p_admin_id: string }
        Returns: Json
      }
      rpc_admin_get_gamification_stats: {
        Args: { p_admin_id: string }
        Returns: Json
      }
      rpc_admin_get_leagues_stats: {
        Args: { p_admin_id: string }
        Returns: Json
      }
      rpc_admin_get_monetization_stats: {
        Args: { p_admin_id: string }
        Returns: Json
      }
      rpc_admin_get_practice_stats: {
        Args: { p_admin_id: string }
        Returns: Json
      }
      rpc_admin_get_users_stats: {
        Args: { p_admin_id: string }
        Returns: Json
      }
      rpc_challenge_rollover_periodic: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      rpc_claim_challenge_reward: {
        Args: { p_instance_id: string; p_user_id: string }
        Returns: Json
      }
      rpc_evaluate_challenges: {
        Args: { p_local_date: string; p_user_id: string; p_user_tz: string }
        Returns: undefined
      }
      rpc_finalize_weekly_leagues: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      rpc_get_achievements: {
        Args: { p_user_id: string }
        Returns: Json
      }
      rpc_get_challenges_view: {
        Args: { p_user_id: string }
        Returns: Json
      }
      rpc_get_dashboard: {
        Args: { p_user_id: string }
        Returns: Json
      }
      rpc_get_global_ranking: {
        Args: { p_user_id: string }
        Returns: Json
      }
      rpc_log_practice: {
        Args: {
          p_idempotency_key: string
          p_minutes: number
          p_note: string
          p_now_utc: string
          p_user_id: string
        }
        Returns: Json
      }
      rpc_rollover_weekly_challenge: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      rpc_save_training_plan: {
        Args: {
          p_days: number[]
          p_times: Json
          p_tz: string
          p_user_id: string
        }
        Returns: Json
      }
    }
    Enums: {
      app_role: "user" | "admin"
      bucket_tier: "beginner" | "intermediate" | "advanced"
      challenge_status: "active" | "done"
      invite_status: "pending" | "accepted"
      league_status: "open" | "locked" | "archived"
      medal_kind: "permanent" | "temporary"
      purchase_status: "pending" | "completed" | "failed"
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
      app_role: ["user", "admin"],
      bucket_tier: ["beginner", "intermediate", "advanced"],
      challenge_status: ["active", "done"],
      invite_status: ["pending", "accepted"],
      league_status: ["open", "locked", "archived"],
      medal_kind: ["permanent", "temporary"],
      purchase_status: ["pending", "completed", "failed"],
    },
  },
} as const
