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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      daily_checkins: {
        Row: {
          caffeine_amount: string | null
          caffeine_last_time: string | null
          caffeine_used: boolean
          checkin_date: string
          created_at: string
          energy_level: number | null
          exercise_done: boolean | null
          id: string
          mood_level: number | null
          outdoor_time: boolean | null
          phone_activity: string | null
          phone_in_bed: boolean | null
          previous_evening_notes: string | null
          rested_level: number | null
          screen_before_bed: boolean | null
          stress_level: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          caffeine_amount?: string | null
          caffeine_last_time?: string | null
          caffeine_used?: boolean
          checkin_date: string
          created_at?: string
          energy_level?: number | null
          exercise_done?: boolean | null
          id?: string
          mood_level?: number | null
          outdoor_time?: boolean | null
          phone_activity?: string | null
          phone_in_bed?: boolean | null
          previous_evening_notes?: string | null
          rested_level?: number | null
          screen_before_bed?: boolean | null
          stress_level?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          caffeine_amount?: string | null
          caffeine_last_time?: string | null
          caffeine_used?: boolean
          checkin_date?: string
          created_at?: string
          energy_level?: number | null
          exercise_done?: boolean | null
          id?: string
          mood_level?: number | null
          outdoor_time?: boolean | null
          phone_activity?: string | null
          phone_in_bed?: boolean | null
          previous_evening_notes?: string | null
          rested_level?: number | null
          screen_before_bed?: boolean | null
          stress_level?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      naps: {
        Row: {
          created_at: string
          duration_minutes: number | null
          ended_at: string | null
          id: string
          nap_date: string
          notes: string | null
          quality: number | null
          started_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_minutes?: number | null
          ended_at?: string | null
          id?: string
          nap_date: string
          notes?: string | null
          quality?: number | null
          started_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          duration_minutes?: number | null
          ended_at?: string | null
          id?: string
          nap_date?: string
          notes?: string | null
          quality?: number | null
          started_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          nickname: string | null
          onboarded_at: string | null
          role: Database["public"]["Enums"]["app_role"]
          sleep_goal_minutes: number
          timezone: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          nickname?: string | null
          onboarded_at?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          sleep_goal_minutes?: number
          timezone?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          nickname?: string | null
          onboarded_at?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          sleep_goal_minutes?: number
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      relationships: {
        Row: {
          created_at: string
          id: string
          partner_id: string
          status: Database["public"]["Enums"]["relationship_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          partner_id: string
          status?: Database["public"]["Enums"]["relationship_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          partner_id?: string
          status?: Database["public"]["Enums"]["relationship_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sharing_permissions: {
        Row: {
          created_at: string
          id: string
          partner_id: string
          share_caffeine: boolean
          share_energy: boolean
          share_everything: boolean
          share_exact_bedtime: boolean
          share_exact_waketime: boolean
          share_insights: boolean
          share_journal: boolean
          share_mood: boolean
          share_naps: boolean
          share_notes: boolean
          share_patterns: boolean
          share_phone_usage: boolean
          share_reasons: boolean
          share_recovery_status: boolean
          share_reset_plan: boolean
          share_sleep_duration: boolean
          share_sleep_quality: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          partner_id: string
          share_caffeine?: boolean
          share_energy?: boolean
          share_everything?: boolean
          share_exact_bedtime?: boolean
          share_exact_waketime?: boolean
          share_insights?: boolean
          share_journal?: boolean
          share_mood?: boolean
          share_naps?: boolean
          share_notes?: boolean
          share_patterns?: boolean
          share_phone_usage?: boolean
          share_reasons?: boolean
          share_recovery_status?: boolean
          share_reset_plan?: boolean
          share_sleep_duration?: boolean
          share_sleep_quality?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          partner_id?: string
          share_caffeine?: boolean
          share_energy?: boolean
          share_everything?: boolean
          share_exact_bedtime?: boolean
          share_exact_waketime?: boolean
          share_insights?: boolean
          share_journal?: boolean
          share_mood?: boolean
          share_naps?: boolean
          share_notes?: boolean
          share_patterns?: boolean
          share_phone_usage?: boolean
          share_reasons?: boolean
          share_recovery_status?: boolean
          share_reset_plan?: boolean
          share_sleep_duration?: boolean
          share_sleep_quality?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sleep_entries: {
        Row: {
          awakenings_count: number | null
          bedtime: string | null
          created_at: string
          fell_asleep_at: string | null
          id: string
          notes: string | null
          out_of_bed_at: string | null
          sleep_date: string
          sleep_latency_minutes: number | null
          sleep_quality: number | null
          total_sleep_minutes: number | null
          updated_at: string
          user_id: string
          wake_time: string | null
        }
        Insert: {
          awakenings_count?: number | null
          bedtime?: string | null
          created_at?: string
          fell_asleep_at?: string | null
          id?: string
          notes?: string | null
          out_of_bed_at?: string | null
          sleep_date: string
          sleep_latency_minutes?: number | null
          sleep_quality?: number | null
          total_sleep_minutes?: number | null
          updated_at?: string
          user_id: string
          wake_time?: string | null
        }
        Update: {
          awakenings_count?: number | null
          bedtime?: string | null
          created_at?: string
          fell_asleep_at?: string | null
          id?: string
          notes?: string | null
          out_of_bed_at?: string | null
          sleep_date?: string
          sleep_latency_minutes?: number | null
          sleep_quality?: number | null
          total_sleep_minutes?: number | null
          updated_at?: string
          user_id?: string
          wake_time?: string | null
        }
        Relationships: []
      }
      sleep_reasons: {
        Row: {
          created_at: string
          detail: string | null
          id: string
          reason: string
          sleep_entry_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          detail?: string | null
          id?: string
          reason: string
          sleep_entry_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          detail?: string | null
          id?: string
          reason?: string
          sleep_entry_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sleep_reasons_sleep_entry_id_fkey"
            columns: ["sleep_entry_id"]
            isOneToOne: false
            referencedRelation: "sleep_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      sleep_reset_plans: {
        Row: {
          adjustment_pace: string
          created_at: string
          current_bedtime: string | null
          day_start_time: string | null
          desired_sleep_minutes: number | null
          id: string
          is_active: boolean
          naps_needed: boolean | null
          personal_goal: string | null
          stages: Json
          started_on: string
          target_bedtime: string | null
          target_wake_time: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          adjustment_pace?: string
          created_at?: string
          current_bedtime?: string | null
          day_start_time?: string | null
          desired_sleep_minutes?: number | null
          id?: string
          is_active?: boolean
          naps_needed?: boolean | null
          personal_goal?: string | null
          stages?: Json
          started_on?: string
          target_bedtime?: string | null
          target_wake_time?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          adjustment_pace?: string
          created_at?: string
          current_bedtime?: string | null
          day_start_time?: string | null
          desired_sleep_minutes?: number | null
          id?: string
          is_active?: boolean
          naps_needed?: boolean | null
          personal_goal?: string | null
          stages?: Json
          started_on?: string
          target_bedtime?: string | null
          target_wake_time?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      wind_down_preferences: {
        Row: {
          communication_style: string
          created_at: string
          duration_minutes: number
          id: string
          in_app_reminders: boolean
          updated_at: string
          use_default_checklist: boolean
          user_id: string
        }
        Insert: {
          communication_style?: string
          created_at?: string
          duration_minutes?: number
          id?: string
          in_app_reminders?: boolean
          updated_at?: string
          use_default_checklist?: boolean
          user_id: string
        }
        Update: {
          communication_style?: string
          created_at?: string
          duration_minutes?: number
          id?: string
          in_app_reminders?: boolean
          updated_at?: string
          use_default_checklist?: boolean
          user_id?: string
        }
        Relationships: []
      }
      wind_down_sessions: {
        Row: {
          completed_at: string
          created_at: string
          duration_minutes: number
          id: string
          session_date: string
          tasks_completed: number
          tasks_skipped: number
          tasks_total: number
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string
          created_at?: string
          duration_minutes?: number
          id?: string
          session_date: string
          tasks_completed?: number
          tasks_skipped?: number
          tasks_total?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string
          created_at?: string
          duration_minutes?: number
          id?: string
          session_date?: string
          tasks_completed?: number
          tasks_skipped?: number
          tasks_total?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      wind_down_tasks: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          label: string
          phase: string
          position: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          label: string
          phase?: string
          position?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          label?: string
          phase?: string
          position?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_shared_recovery_status: { Args: { _user_id: string }; Returns: Json }
      get_shared_reset_plan: { Args: { _user_id: string }; Returns: Json }
      get_shared_sleep_days: {
        Args: { _days?: number; _user_id: string }
        Returns: Json
      }
      is_actively_linked: { Args: { _a: string; _b: string }; Returns: boolean }
    }
    Enums: {
      app_role: "user" | "partner"
      relationship_status: "pending" | "active" | "disconnected"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["user", "partner"],
      relationship_status: ["pending", "active", "disconnected"],
    },
  },
} as const
