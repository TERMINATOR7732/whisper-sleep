import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export interface StreakDay {
  date: string;
  day_label: string;
  completed: boolean;
  is_today: boolean;
}

export interface StreakData {
  current_streak: number;
  longest_streak: number;
  checked_in_today: boolean;
  recent_days: StreakDay[];
}

export function useStreak() {
  const { user, loading: authLoading } = useAuth();

  const query = useQuery({
    queryKey: ["streak", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async (): Promise<StreakData> => {
      // get_my_streak is SECURITY DEFINER and derives data for auth.uid()
      const { data, error } = await supabase.rpc("get_my_streak");
      if (error) {
        throw error;
      }
      return data as unknown as StreakData;
    },
    staleTime: 60 * 1000,
  });

  return {
    ...query,
    streak: query.data ?? null,
    isLoading: authLoading || query.isLoading,
  };
}
