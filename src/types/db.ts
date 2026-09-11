import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];
export type RelationshipStatus = Database["public"]["Enums"]["relationship_status"];

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];
export type Relationship = Database["public"]["Tables"]["relationships"]["Row"];
export type SharingPermissions = Database["public"]["Tables"]["sharing_permissions"]["Row"];

export type SleepEntry = Database["public"]["Tables"]["sleep_entries"]["Row"];
export type Nap = Database["public"]["Tables"]["naps"]["Row"];
export type DailyCheckin = Database["public"]["Tables"]["daily_checkins"]["Row"];
export type SleepReason = Database["public"]["Tables"]["sleep_reasons"]["Row"];

export const ROLE_LABELS: Record<AppRole, string> = {
  user: "Primary user",
  partner: "Partner",
};
