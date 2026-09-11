import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Profile, ProfileUpdate } from "@/types/db";

import { useAuth } from "./use-auth";

export function useProfile() {
  const { user, loading } = useAuth();

  const query = useQuery({
    queryKey: ["profile", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async (): Promise<Profile | null> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  return { ...query, isLoading: loading || query.isLoading };
}

export function useUpdateProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (values: ProfileUpdate): Promise<Profile> => {
      if (!user) throw new Error("You need to be signed in.");
      const { data, error } = await supabase
        .from("profiles")
        .upsert({ id: user.id, ...values })
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["profile", user?.id], data);
    },
  });
}
