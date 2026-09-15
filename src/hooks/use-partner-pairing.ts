import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import type { Profile } from "@/types/db";

import { useAuth } from "./use-auth";

export interface ActiveInviteData {
  invite_code: string;
  expires_at: string;
  created_at: string;
  status: string;
}

export interface ConnectedPartnerInfo {
  relationshipId: string;
  connectedUserId: string;
  connectedProfile: Profile | null;
  connectedAt: string;
}

function cleanErrorMessage(err: unknown, fallback: string): string {
  if (!err) return fallback;
  if (typeof err === "object" && err !== null && "message" in err) {
    const msg = String((err as { message: unknown }).message);
    // Remove Postgres error prefixes like "ERROR: " or "P0001: "
    const match = msg.match(/^(?:ERROR:\s*|P0001:\s*)?(.*)$/i);
    return (match?.[1]?.trim()) || msg;
  }
  return String(err);
}

/** Fetch the active pending invite code for the primary user. */
export function usePartnerInvite() {
  const { user, loading } = useAuth();

  const query = useQuery({
    queryKey: ["my-partner-invite", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async (): Promise<ActiveInviteData | null> => {
      const { data, error } = await supabase.rpc("get_my_partner_invite");
      if (error) throw error;
      if (!data) return null;
      return data as unknown as ActiveInviteData;
    },
    refetchInterval: 30000, // Re-check every 30 seconds
  });

  return { ...query, isLoading: loading || query.isLoading };
}

/** Hook to inspect the current active connection and connected partner's profile. */
export function useActiveConnection() {
  const { user, loading } = useAuth();

  const query = useQuery({
    queryKey: ["active-connection", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async (): Promise<ConnectedPartnerInfo | null> => {
      const { data: rel, error: relError } = await supabase
        .from("relationships")
        .select("id, user_id, partner_id, status, created_at")
        .eq("status", "active")
        .limit(1)
        .maybeSingle();

      if (relError) throw relError;
      if (!rel) return null;

      const otherUserId = rel.user_id === user!.id ? rel.partner_id : rel.user_id;

      // Fetch the other user's profile
      const { data: profile, error: profError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", otherUserId)
        .maybeSingle();

      if (profError) {
        console.warn("Could not load partner profile:", profError);
      }

      return {
        relationshipId: rel.id,
        connectedUserId: otherUserId,
        connectedProfile: (profile as Profile) ?? null,
        connectedAt: rel.created_at,
      };
    },
  });

  return { ...query, isLoading: loading || query.isLoading };
}

/** Mutation to create a fresh partner invite code (expires in 24 hours). */
export function useCreatePartnerInvite() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("create_partner_invite");
      if (error) throw new Error(cleanErrorMessage(error, "Failed to create invite code."));
      return data as unknown as ActiveInviteData;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["my-partner-invite", user?.id], data);
      queryClient.invalidateQueries({ queryKey: ["my-partner-invite"] });
      toast.success("Invite code created");
    },
    onError: (err: Error) => {
      toast.error(cleanErrorMessage(err, "Could not create invite code."));
    },
  });
}

/** Mutation to cancel an existing pending partner invite code. */
export function useCancelPartnerInvite() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("cancel_partner_invite");
      if (error) throw new Error(cleanErrorMessage(error, "Failed to cancel invite code."));
      return true;
    },
    onSuccess: () => {
      queryClient.setQueryData(["my-partner-invite", user?.id], null);
      queryClient.invalidateQueries({ queryKey: ["my-partner-invite"] });
      toast.success("Invite code cancelled");
    },
    onError: (err: Error) => {
      toast.error(cleanErrorMessage(err, "Could not cancel invite code."));
    },
  });
}

/** Mutation for the partner to submit and accept an invite code. */
export function useAcceptPartnerInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (rawCode: string) => {
      const trimmed = rawCode.trim();
      if (!trimmed) {
        throw new Error("Please enter an invite code.");
      }
      const { data, error } = await supabase.rpc("accept_partner_invite", {
        raw_code: trimmed,
      });
      if (error) throw new Error(cleanErrorMessage(error, "Failed to accept invite code."));
      return data;
    },
    onSuccess: () => {
      // Invalidate all related connection and sharing states
      queryClient.invalidateQueries({ queryKey: ["linked-user"] });
      queryClient.invalidateQueries({ queryKey: ["active-partner"] });
      queryClient.invalidateQueries({ queryKey: ["active-connection"] });
      queryClient.invalidateQueries({ queryKey: ["sharing-permissions"] });
      queryClient.invalidateQueries({ queryKey: ["shared-reset-plan"] });
      queryClient.invalidateQueries({ queryKey: ["shared-recovery-status"] });
      queryClient.invalidateQueries({ queryKey: ["my-partner-invite"] });
      toast.success("Connected with your partner!");
    },
  });
}

/** Mutation to disconnect an active partner relationship. */
export function useDisconnectPartner() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("disconnect_partner");
      if (error) throw new Error(cleanErrorMessage(error, "Failed to disconnect."));
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["linked-user"] });
      queryClient.invalidateQueries({ queryKey: ["active-partner"] });
      queryClient.invalidateQueries({ queryKey: ["active-connection"] });
      queryClient.invalidateQueries({ queryKey: ["sharing-permissions"] });
      queryClient.invalidateQueries({ queryKey: ["shared-reset-plan"] });
      queryClient.invalidateQueries({ queryKey: ["shared-recovery-status"] });
      queryClient.invalidateQueries({ queryKey: ["my-partner-invite"] });
      toast.info("Partner connection disconnected");
    },
    onError: (err: Error) => {
      toast.error(cleanErrorMessage(err, "Could not disconnect partner."));
    },
  });
}
