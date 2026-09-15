import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { NotificationPreferences, NotificationPreferencesInsert, NotificationPreferencesUpdate } from "@/types/db";
import { useAuth } from "./use-auth";

export const DEFAULT_NOTIFICATION_PREFERENCES: Omit<NotificationPreferences, "user_id" | "created_at" | "updated_at"> = {
  checkin_reminders_enabled: true,
  wind_down_reminders_enabled: true,
  streak_reminders_enabled: true,
  checkin_reminder_time: "20:00",
  wind_down_reminder_time: "22:30",
  quiet_hours_enabled: false,
  quiet_hours_start: "22:00",
  quiet_hours_end: "07:00",
};

export function useNotificationPreferences() {
  const { user, loading: authLoading } = useAuth();

  const query = useQuery({
    queryKey: ["notification-preferences", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async (): Promise<NotificationPreferences | null> => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        return {
          user_id: user.id,
          ...DEFAULT_NOTIFICATION_PREFERENCES,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      }

      return data;
    },
  });

  return {
    ...query,
    preferences: query.data ?? null,
    isLoading: authLoading || query.isLoading,
  };
}

export function useUpdateNotificationPreferences() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (values: Partial<NotificationPreferencesUpdate>): Promise<NotificationPreferences> => {
      if (!user) throw new Error("You must be signed in to save reminder preferences.");

      const payload: NotificationPreferencesInsert = {
        user_id: user.id,
        ...values,
      };

      const { data, error } = await supabase
        .from("notification_preferences")
        .upsert(payload, { onConflict: "user_id" })
        .select("*")
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["notification-preferences", user?.id], data);
      queryClient.invalidateQueries({ queryKey: ["notification-preferences", user?.id] });
    },
  });
}
