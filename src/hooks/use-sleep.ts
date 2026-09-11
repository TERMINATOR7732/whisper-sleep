import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { minutesBetween } from "@/lib/sleep";
import type { DailyCheckin, Nap, SleepEntry, SleepReason } from "@/types/db";

import { useAuth } from "./use-auth";

export type DayLog = {
  date: string;
  sleep: SleepEntry | null;
  checkin: DailyCheckin | null;
  naps: Nap[];
  reasons: SleepReason[];
};

export type NapInput = {
  id?: string;
  started_at: string | null;
  ended_at: string | null;
  quality: number | null;
  notes: string | null;
};

export type DayLogInput = {
  date: string;
  sleep: {
    bedtime: string | null;
    fell_asleep_at: string | null;
    wake_time: string | null;
    out_of_bed_at: string | null;
    sleep_quality: number | null;
    awakenings_count: number | null;
    notes: string | null;
  };
  checkin: {
    energy_level: number | null;
    mood_level: number | null;
    rested_level: number | null;
    caffeine_used: boolean;
    caffeine_amount: string | null;
    caffeine_last_time: string | null;
    screen_before_bed: boolean | null;
    phone_in_bed: boolean | null;
    phone_activity: string | null;
    exercise_done: boolean | null;
    outdoor_time: boolean | null;
    previous_evening_notes: string | null;
  };
  naps: NapInput[];
  reasons: { reason: string; detail?: string | null }[];
};

export function dayLogKey(userId: string | undefined, date: string) {
  return ["day-log", userId, date] as const;
}

export function useDayLog(date: string) {
  const { user, loading } = useAuth();

  const query = useQuery({
    queryKey: dayLogKey(user?.id, date),
    enabled: Boolean(user?.id && date),
    queryFn: async (): Promise<DayLog> => {
      const [sleepRes, checkinRes, napsRes] = await Promise.all([
        supabase.from("sleep_entries").select("*").eq("sleep_date", date).maybeSingle(),
        supabase.from("daily_checkins").select("*").eq("checkin_date", date).maybeSingle(),
        supabase.from("naps").select("*").eq("nap_date", date).order("started_at", { ascending: true }),
      ]);
      if (sleepRes.error) throw sleepRes.error;
      if (checkinRes.error) throw checkinRes.error;
      if (napsRes.error) throw napsRes.error;

      let reasons: SleepReason[] = [];
      if (sleepRes.data) {
        const reasonRes = await supabase
          .from("sleep_reasons")
          .select("*")
          .eq("sleep_entry_id", sleepRes.data.id);
        if (reasonRes.error) throw reasonRes.error;
        reasons = reasonRes.data ?? [];
      }

      return {
        date,
        sleep: sleepRes.data ?? null,
        checkin: checkinRes.data ?? null,
        naps: napsRes.data ?? [],
        reasons,
      };
    },
  });

  return { ...query, isLoading: loading || query.isLoading };
}

export type HistoryItem = {
  date: string;
  sleep: SleepEntry | null;
  checkin: DailyCheckin | null;
  napMinutes: number;
};

export function useSleepHistory(limit = 30) {
  const { user, loading } = useAuth();

  const query = useQuery({
    queryKey: ["sleep-history", user?.id, limit],
    enabled: Boolean(user?.id),
    queryFn: async (): Promise<HistoryItem[]> => {
      const [entries, checkins, naps] = await Promise.all([
        supabase
          .from("sleep_entries")
          .select("*")
          .order("sleep_date", { ascending: false })
          .limit(limit),
        supabase
          .from("daily_checkins")
          .select("*")
          .order("checkin_date", { ascending: false })
          .limit(limit),
        supabase.from("naps").select("*").order("nap_date", { ascending: false }).limit(limit * 4),
      ]);
      if (entries.error) throw entries.error;
      if (checkins.error) throw checkins.error;
      if (naps.error) throw naps.error;

      const dates = new Set<string>();
      entries.data?.forEach((e) => dates.add(e.sleep_date));
      checkins.data?.forEach((c) => dates.add(c.checkin_date));
      naps.data?.forEach((n) => dates.add(n.nap_date));

      return [...dates]
        .sort((a, b) => (a < b ? 1 : -1))
        .slice(0, limit)
        .map((date) => ({
          date,
          sleep: entries.data?.find((e) => e.sleep_date === date) ?? null,
          checkin: checkins.data?.find((c) => c.checkin_date === date) ?? null,
          napMinutes: (naps.data ?? [])
            .filter((n) => n.nap_date === date)
            .reduce((total, nap) => total + (nap.duration_minutes ?? 0), 0),
        }));
    },
  });

  return { ...query, isLoading: loading || query.isLoading };
}

export function useSaveDayLog() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: DayLogInput) => {
      if (!user) throw new Error("You need to be signed in.");
      const userId = user.id;
      const { sleep, checkin, naps, reasons, date } = input;

      const latency = minutesBetween(sleep.bedtime, sleep.fell_asleep_at);
      const totalSleep = minutesBetween(sleep.fell_asleep_at ?? sleep.bedtime, sleep.wake_time);

      const hasSleep =
        sleep.bedtime ||
        sleep.fell_asleep_at ||
        sleep.wake_time ||
        sleep.out_of_bed_at ||
        sleep.sleep_quality != null ||
        sleep.awakenings_count != null ||
        sleep.notes;

      let sleepEntryId: string | null = null;
      if (hasSleep) {
        const { data, error } = await supabase
          .from("sleep_entries")
          .upsert(
            {
              user_id: userId,
              sleep_date: date,
              ...sleep,
              sleep_latency_minutes: latency,
              total_sleep_minutes: totalSleep,
            },
            { onConflict: "user_id,sleep_date" },
          )
          .select("id")
          .single();
        if (error) throw error;
        sleepEntryId = data.id;
      }

      const { error: checkinError } = await supabase.from("daily_checkins").upsert(
        { user_id: userId, checkin_date: date, ...checkin },
        { onConflict: "user_id,checkin_date" },
      );
      if (checkinError) throw checkinError;

      const { error: napDeleteError } = await supabase
        .from("naps")
        .delete()
        .eq("user_id", userId)
        .eq("nap_date", date);
      if (napDeleteError) throw napDeleteError;

      const napRows = naps
        .filter((nap) => nap.started_at && nap.ended_at)
        .map((nap) => ({
          user_id: userId,
          nap_date: date,
          started_at: nap.started_at,
          ended_at: nap.ended_at,
          duration_minutes: minutesBetween(nap.started_at, nap.ended_at),
          quality: nap.quality,
          notes: nap.notes,
        }));
      if (napRows.length > 0) {
        const { error } = await supabase.from("naps").insert(napRows);
        if (error) throw error;
      }

      if (sleepEntryId) {
        const { error: reasonDeleteError } = await supabase
          .from("sleep_reasons")
          .delete()
          .eq("user_id", userId)
          .eq("sleep_entry_id", sleepEntryId);
        if (reasonDeleteError) throw reasonDeleteError;

        if (reasons.length > 0) {
          const { error } = await supabase.from("sleep_reasons").insert(
            reasons.map((r) => ({
              user_id: userId,
              sleep_entry_id: sleepEntryId,
              reason: r.reason,
              detail: r.detail ?? null,
            })),
          );
          if (error) throw error;
        }
      }

      return { date };
    },
    onSuccess: ({ date }) => {
      queryClient.invalidateQueries({ queryKey: dayLogKey(user?.id, date) });
      queryClient.invalidateQueries({ queryKey: ["sleep-history", user?.id] });
    },
  });
}

export function useDeleteDayLog() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (date: string) => {
      if (!user) throw new Error("You need to be signed in.");
      const userId = user.id;
      const results = await Promise.all([
        supabase.from("sleep_entries").delete().eq("user_id", userId).eq("sleep_date", date),
        supabase.from("daily_checkins").delete().eq("user_id", userId).eq("checkin_date", date),
        supabase.from("naps").delete().eq("user_id", userId).eq("nap_date", date),
      ]);
      for (const result of results) if (result.error) throw result.error;
      return { date };
    },
    onSuccess: ({ date }) => {
      queryClient.invalidateQueries({ queryKey: dayLogKey(user?.id, date) });
      queryClient.invalidateQueries({ queryKey: ["sleep-history", user?.id] });
    },
  });
}
