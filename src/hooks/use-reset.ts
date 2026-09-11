import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_WIND_DOWN_TASKS, type WindDownTaskDraft } from "@/lib/wind-down";
import type { Database } from "@/integrations/supabase/types";

import { useAuth } from "./use-auth";

export type ResetPlan = Database["public"]["Tables"]["sleep_reset_plans"]["Row"];
export type ResetPlanInput = {
  desired_sleep_minutes: number | null;
  target_wake_time: string | null;
  current_bedtime: string | null;
  target_bedtime: string | null;
  day_start_time: string | null;
  adjustment_pace: string;
  naps_needed: boolean | null;
  personal_goal: string | null;
  stages: unknown;
  restart?: boolean;
};

export type WindDownPreferences = Database["public"]["Tables"]["wind_down_preferences"]["Row"];
export type WindDownTask = Database["public"]["Tables"]["wind_down_tasks"]["Row"];
export type WindDownSession = Database["public"]["Tables"]["wind_down_sessions"]["Row"];

/* ---------- reset plan ---------- */

export function useResetPlan() {
  const { user, loading } = useAuth();

  const query = useQuery({
    queryKey: ["reset-plan", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async (): Promise<ResetPlan | null> => {
      const { data, error } = await supabase
        .from("sleep_reset_plans")
        .select("*")
        .eq("is_active", true)
        .order("started_on", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
  });

  return { ...query, isLoading: loading || query.isLoading };
}

export function useSaveResetPlan() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ResetPlanInput & { id?: string | null }): Promise<ResetPlan> => {
      if (!user) throw new Error("You need to be signed in.");
      const { id, restart, ...values } = input;
      const payload = {
        user_id: user.id,
        ...values,
        stages: (values.stages ?? []) as never,
        is_active: true,
        ...(restart ? { started_on: new Date().toISOString().slice(0, 10) } : {}),
      };

      if (id) {
        const { data, error } = await supabase
          .from("sleep_reset_plans")
          .update(payload)
          .eq("id", id)
          .select("*")
          .single();
        if (error) throw error;
        return data;
      }

      const { data, error } = await supabase
        .from("sleep_reset_plans")
        .insert(payload)
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["reset-plan", user?.id], data);
    },
  });
}

/* ---------- wind-down preferences ---------- */

export function useWindDownPreferences() {
  const { user, loading } = useAuth();

  const query = useQuery({
    queryKey: ["wind-down-prefs", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async (): Promise<WindDownPreferences | null> => {
      const { data, error } = await supabase
        .from("wind_down_preferences")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
  });

  return { ...query, isLoading: loading || query.isLoading };
}

export function useSaveWindDownPreferences() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      input: Partial<Pick<WindDownPreferences, "duration_minutes" | "communication_style" | "in_app_reminders" | "use_default_checklist">> & {
        id?: string | null;
      },
    ): Promise<WindDownPreferences> => {
      if (!user) throw new Error("You need to be signed in.");
      const { id, ...values } = input;
      if (id) {
        const { data, error } = await supabase
          .from("wind_down_preferences")
          .update(values)
          .eq("id", id)
          .select("*")
          .single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase
        .from("wind_down_preferences")
        .insert({ user_id: user.id, ...values })
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["wind-down-prefs", user?.id], data);
    },
  });
}

/* ---------- wind-down tasks ---------- */

export function useWindDownTasks() {
  const { user, loading } = useAuth();

  const query = useQuery({
    queryKey: ["wind-down-tasks", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async (): Promise<WindDownTask[]> => {
      const { data, error } = await supabase
        .from("wind_down_tasks")
        .select("*")
        .order("position", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  return { ...query, isLoading: loading || query.isLoading };
}

/** Replaces the whole checklist so ordering, edits and removals persist together. */
export function useSaveWindDownTasks() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tasks: WindDownTaskDraft[]): Promise<WindDownTask[]> => {
      if (!user) throw new Error("You need to be signed in.");
      const { error: deleteError } = await supabase
        .from("wind_down_tasks")
        .delete()
        .eq("user_id", user.id);
      if (deleteError) throw deleteError;

      const rows = tasks
        .filter((task) => task.label.trim().length > 0)
        .map((task, index) => ({
          user_id: user.id,
          label: task.label.trim(),
          phase: task.phase,
          position: index,
          enabled: task.enabled,
        }));

      if (rows.length === 0) return [];
      const { data, error } = await supabase
        .from("wind_down_tasks")
        .insert(rows)
        .select("*")
        .order("position", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["wind-down-tasks", user?.id], data);
    },
  });
}

export function useSeedDefaultTasks() {
  const save = useSaveWindDownTasks();
  return {
    ...save,
    seed: () =>
      save.mutateAsync(
        DEFAULT_WIND_DOWN_TASKS.map((task, index) => ({
          label: task.label,
          phase: task.phase,
          position: index,
          enabled: true,
        })),
      ),
  };
}

/* ---------- wind-down sessions ---------- */

export function useWindDownSessions(limit = 14) {
  const { user, loading } = useAuth();

  const query = useQuery({
    queryKey: ["wind-down-sessions", user?.id, limit],
    enabled: Boolean(user?.id),
    queryFn: async (): Promise<WindDownSession[]> => {
      const { data, error } = await supabase
        .from("wind_down_sessions")
        .select("*")
        .order("session_date", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data ?? [];
    },
  });

  return { ...query, isLoading: loading || query.isLoading };
}

export function useLogWindDownSession() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      session_date: string;
      duration_minutes: number;
      tasks_completed: number;
      tasks_skipped: number;
      tasks_total: number;
    }): Promise<WindDownSession> => {
      if (!user) throw new Error("You need to be signed in.");
      const { data, error } = await supabase
        .from("wind_down_sessions")
        .insert({ user_id: user.id, ...input, completed_at: new Date().toISOString() })
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["wind-down-sessions", user?.id] });
    },
  });
}
