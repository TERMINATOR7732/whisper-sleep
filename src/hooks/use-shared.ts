import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

import { useAuth } from "./use-auth";

/** The id of the person the signed-in partner is actively linked to, if any. */
export function useLinkedUserId() {
  const { user, loading } = useAuth();

  const query = useQuery({
    queryKey: ["linked-user", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase
        .from("relationships")
        .select("user_id, partner_id, status")
        .eq("status", "active")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return data.user_id === user!.id ? data.partner_id : data.user_id;
    },
  });

  return { ...query, isLoading: loading || query.isLoading };
}

/** The active partner id for a signed-in primary user, if one exists. */
export function useActivePartnerId() {
  const { user, loading } = useAuth();

  const query = useQuery({
    queryKey: ["active-partner", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase
        .from("relationships")
        .select("partner_id")
        .eq("user_id", user!.id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data?.partner_id ?? null;
    },
  });

  return { ...query, isLoading: loading || query.isLoading };
}

export function useSharingPermissions(partnerId: string | null | undefined) {
  const { user, loading } = useAuth();

  const query = useQuery({
    queryKey: ["sharing-permissions", user?.id, partnerId],
    enabled: Boolean(user?.id && partnerId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sharing_permissions")
        .select("*")
        .eq("user_id", user!.id)
        .eq("partner_id", partnerId!)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
  });

  return { ...query, isLoading: loading || query.isLoading };
}

export function useSaveSharingPermissions() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      partnerId,
      values,
    }: {
      partnerId: string;
      values: { share_reset_plan?: boolean; share_recovery_status?: boolean };
    }) => {
      if (!user) throw new Error("You need to be signed in.");
      const { data, error } = await supabase
        .from("sharing_permissions")
        .upsert(
          { user_id: user.id, partner_id: partnerId, ...values },
          { onConflict: "user_id,partner_id" },
        )
        .select("*")
        .single();
      if (error) throw error;
      return { partnerId, permissions: data };
    },
    onSuccess: ({ partnerId, permissions }) => {
      queryClient.setQueryData(["sharing-permissions", user?.id, partnerId], permissions);
    },
  });
}

export type SharedResetPlan = {
  shared: boolean;
  has_plan?: boolean;
  desired_sleep_minutes?: number | null;
  target_bedtime?: string | null;
  target_wake_time?: string | null;
  adjustment_pace?: string | null;
  started_on?: string | null;
  stages?: { id: string; bedtime: string; nights: number; note?: string }[];
};

export function useSharedResetPlan(userId: string | null | undefined) {
  return useQuery({
    queryKey: ["shared-reset-plan", userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<SharedResetPlan> => {
      const { data, error } = await supabase.rpc("get_shared_reset_plan", { _user_id: userId! });
      if (error) throw error;
      return (data ?? { shared: false }) as SharedResetPlan;
    },
  });
}

export type SharedRecoveryStatus = {
  shared: boolean;
  status?: "rough" | "okay" | "unknown";
  as_of?: string;
};

export function useSharedRecoveryStatus(userId: string | null | undefined) {
  return useQuery({
    queryKey: ["shared-recovery-status", userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<SharedRecoveryStatus> => {
      const { data, error } = await supabase.rpc("get_shared_recovery_status", { _user_id: userId! });
      if (error) throw error;
      return (data ?? { shared: false }) as SharedRecoveryStatus;
    },
  });
}
