import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import { sendPushToUser, type PushNotificationPayload, type VapidConfig } from "../_shared/push.ts";
import {
  formatNotificationBody,
  hashString,
  selectTemplateIndex,
} from "../_shared/notification-templates.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-scheduler-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/**
 * Parses "HH:MM" or "HH:MM:SS" into minutes since midnight (0..1439).
 */
export function parseTimeToMinutes(timeStr: string | null | undefined): number | null {
  if (!timeStr) return null;
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }
  return hours * 60 + minutes;
}

/**
 * Evaluates whether nowMins falls within quiet hours.
 * Accurately supports spans that cross midnight (e.g. 22:00 -> 07:00).
 */
export function isQuiet(nowMins: number, qStart: number, qEnd: number): boolean {
  if (qStart > qEnd) {
    // Crosses midnight (e.g. 22:00 [1320] -> 07:00 [420])
    return nowMins >= qStart || nowMins < qEnd;
  }
  // Same day span (e.g. 01:00 [60] -> 06:00 [360])
  return nowMins >= qStart && nowMins < qEnd;
}

/**
 * Validates that a timezone string is a known IANA timezone by attempting to
 * use it with Intl.DateTimeFormat. Throws on invalid/unknown timezone.
 */
export function validateTimezone(tz: string): void {
  // This throws a RangeError for unknown timezones in all modern V8/Deno environments.
  new Intl.DateTimeFormat("en-US", { timeZone: tz });
}

/**
 * Resolves local calendar date (YYYY-MM-DD), minutes since local midnight,
 * and yesterday's local date (YYYY-MM-DD) for a given IANA timezone.
 *
 * IMPORTANT: The timezone is validated before use; this function will throw
 * a RangeError for invalid/unrecognised IANA timezone identifiers.
 */
export function getZonedTime(date: Date, timeZone: string): { localDate: string; localYesterday: string; nowMins: number } {
  // validateTimezone throws RangeError for unrecognised timezones
  validateTimezone(timeZone);

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const partMap: Record<string, string> = {};
  for (const p of parts) {
    partMap[p.type] = p.value;
  }

  const year = partMap["year"];
  const month = partMap["month"];
  const day = partMap["day"];
  let hour = parseInt(partMap["hour"], 10);
  if (hour === 24) hour = 0;
  const minute = parseInt(partMap["minute"], 10);

  const localDate = `${year}-${month}-${day}`;
  const nowMins = hour * 60 + minute;

  // Calculate local yesterday by shifting 24 hours back
  const yesterdayDate = new Date(date.getTime() - 24 * 60 * 60 * 1000);
  const yParts = formatter.formatToParts(yesterdayDate);
  const yMap: Record<string, string> = {};
  for (const p of yParts) {
    yMap[p.type] = p.value;
  }
  const localYesterday = `${yMap["year"]}-${yMap["month"]}-${yMap["day"]}`;

  return { localDate, localYesterday, nowMins };
}

/**
 * Returns true if tz is a non-empty string that resolves to a valid IANA timezone.
 * Never falls back to UTC. Returns false for null, empty, whitespace, or unrecognised values.
 */
export function isValidTimezone(tz: unknown): tz is string {
  if (typeof tz !== "string" || tz.trim().length === 0) return false;
  try {
    validateTimezone(tz.trim());
    return true;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Atomic idempotency helpers (wrapping Postgres RPC calls)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Atomically claims a notification slot by calling the claim_notification_slot
 * Postgres function. Returns true only if THIS caller successfully reserved the
 * (user_id, notification_type, local_date) slot in the database.
 *
 * Concurrent callers for the same tuple will receive false (exactly one wins).
 * Stale 'pending' rows older than 10 minutes are automatically reclaimed.
 */
async function claimSlot(
  adminClient: ReturnType<typeof createClient>,
  userId: string,
  notificationType: string,
  localDate: string,
): Promise<boolean> {
  // Generate a unique claim token per call. Only the caller whose token is
  // persisted by the atomic INSERT wins the claim. Two concurrent calls for
  // the same (user, type, date) will each provide a different token, and
  // exactly one will have their token stored in the database.
  const claimToken = crypto.randomUUID();
  const { data, error } = await adminClient.rpc("claim_notification_slot", {
    p_user_id: userId,
    p_type: notificationType,
    p_local_date: localDate,
    p_scheduled_for: new Date().toISOString(),
    p_claim_token: claimToken,
  });
  if (error) {
    throw new Error(`claim_notification_slot RPC failed: ${error.message}`);
  }
  return Boolean(data);
}

/**
 * Marks a successfully-delivered notification slot as 'sent'.
 * Must only be called after confirmed push delivery.
 */
async function markSent(
  adminClient: ReturnType<typeof createClient>,
  userId: string,
  notificationType: string,
  localDate: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  const { error } = await adminClient.rpc("mark_notification_sent", {
    p_user_id: userId,
    p_type: notificationType,
    p_local_date: localDate,
    p_metadata: metadata,
  });
  if (error) {
    console.error(`mark_notification_sent RPC failed for ${notificationType}/${localDate}:`, error.message);
  }
}

/**
 * Marks a failed push delivery slot as 'failed'.
 * Prevents false success records and retains the slot (no retry on same local day).
 */
async function markFailed(
  adminClient: ReturnType<typeof createClient>,
  userId: string,
  notificationType: string,
  localDate: string,
  reason: string,
): Promise<void> {
  const { error } = await adminClient.rpc("mark_notification_failed", {
    p_user_id: userId,
    p_type: notificationType,
    p_local_date: localDate,
    p_reason: reason,
  });
  if (error) {
    console.error(`mark_notification_failed RPC failed for ${notificationType}/${localDate}:`, error.message);
  }
}

/**
 * Fetches recent template indexes for this user and notification type
 * from notification_logs to prevent duplicate/repeated copy.
 */
async function getRecentTemplateIndexes(
  adminClient: ReturnType<typeof createClient>,
  userId: string,
  notificationType: string,
  limit = 10,
): Promise<number[]> {
  try {
    const { data, error } = await adminClient
      .from("notification_logs")
      .select("metadata")
      .eq("user_id", userId)
      .eq("notification_type", notificationType)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error || !data) return [];
    const indexes: number[] = [];
    for (const row of data) {
      const meta = row.metadata as Record<string, unknown> | null;
      if (meta && typeof meta.template_index === "number") {
        indexes.push(meta.template_index);
      }
    }
    return indexes;
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Reminder dispatch: claim → send → mark (atomic state machine)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Attempts to send one reminder with full atomic idempotency.
 *
 * Flow:
 *   1. claimSlot() → atomically reserve the slot (INSERT ON CONFLICT DO NOTHING).
 *      Returns false if another executor already claimed it → abort, no push sent.
 *   2. sendPushToUser() → deliver push notification to all user subscriptions.
 *   3. If delivery returned sent > 0: markSent() → record success.
 *      If delivery returned sent == 0 (no subs / all failed): markFailed().
 *
 * Returns whether a push was actually sent.
 */
async function sendReminderAtomic(
  adminClient: ReturnType<typeof createClient>,
  userId: string,
  notificationType: string,
  localDate: string,
  payload: PushNotificationPayload,
  vapidConfig: VapidConfig,
  extraMetadata?: Record<string, unknown>,
): Promise<boolean> {
  // Step 1: Atomic claim
  const claimed = await claimSlot(adminClient, userId, notificationType, localDate);
  if (!claimed) {
    // Another executor already holds a valid or terminal record for this slot.
    return false;
  }

  // Step 2: Deliver push
  let pushResult;
  try {
    pushResult = await sendPushToUser(adminClient, userId, payload, vapidConfig);
  } catch (err: unknown) {
    const reason = err instanceof Error ? err.message : "unknown_push_error";
    await markFailed(adminClient, userId, notificationType, localDate, reason);
    return false;
  }

  // Step 3: Mark outcome
  if (pushResult.ok && pushResult.sent > 0) {
    await markSent(adminClient, userId, notificationType, localDate, {
      sent: pushResult.sent,
      removed: pushResult.removed,
      ...(extraMetadata || {}),
    });
    return true;
  } else {
    await markFailed(
      adminClient,
      userId,
      notificationType,
      localDate,
      pushResult.totalSubscriptions === 0 ? "no_subscriptions" : "push_delivery_returned_zero_sent",
    );
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main handler
// ─────────────────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // 1. Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // 2. Enforce POST method
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ ok: false, error: "Method not allowed. Only POST is supported." }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // 3. Authorization Check: Require service-role key or dedicated scheduler secret
  const authHeader = req.headers.get("Authorization") || "";
  const schedulerSecretHeader = req.headers.get("x-scheduler-secret") || "";

  const expectedServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const expectedCronSecret = Deno.env.get("CRON_SECRET") || "";

  const isServiceRole =
    authHeader.startsWith("Bearer ") &&
    expectedServiceRoleKey &&
    authHeader.replace("Bearer ", "").trim() === expectedServiceRoleKey.trim();

  const isCronSecret =
    expectedCronSecret &&
    (schedulerSecretHeader.trim() === expectedCronSecret.trim() ||
      authHeader.replace("Bearer ", "").trim() === expectedCronSecret.trim());

  if (!isServiceRole && !isCronSecret) {
    return new Response(
      JSON.stringify({ ok: false, error: "Unauthorized. Scheduled execution requires server-level authorization." }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // 4. Reject client-supplied targeting or payload overrides
  let body: Record<string, unknown> = {};
  try {
    const text = await req.text();
    if (text.trim().length > 0) {
      body = JSON.parse(text);
    }
  } catch {
    return new Response(
      JSON.stringify({ ok: false, error: "Malformed JSON request body" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const forbiddenKeys = ["user_id", "userId", "content", "payload", "custom_payload", "message", "title", "body"];
  if (forbiddenKeys.some((k) => k in body)) {
    return new Response(
      JSON.stringify({ ok: false, error: "Specifying user_id or custom payload is prohibited. Reminders are evaluated server-side." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // 5. Initialize Supabase Admin client
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  if (!supabaseUrl || !expectedServiceRoleKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    return new Response(
      JSON.stringify({ ok: false, error: "Server configuration error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const adminClient = createClient(supabaseUrl, expectedServiceRoleKey, {
    auth: { persistSession: false },
  });

  // 6. Load VAPID credentials
  const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY") || Deno.env.get("VITE_VAPID_PUBLIC_KEY");
  const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:support@nightly.app";

  if (!vapidPrivateKey || !vapidPublicKey) {
    console.error("VAPID server secrets are missing");
    return new Response(
      JSON.stringify({ ok: false, error: "Server VAPID credentials are not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const vapidConfig: VapidConfig = {
    subject: vapidSubject,
    publicKey: vapidPublicKey,
    privateKey: vapidPrivateKey,
  };

  // 7. Query primary users only (role = 'user')
  const { data: primaryProfiles, error: profileErr } = await adminClient
    .from("profiles")
    .select("id, role, timezone, display_name, nickname")
    .eq("role", "user");

  if (profileErr) {
    console.error("Failed to query profiles:", profileErr.message);
    return new Response(
      JSON.stringify({ ok: false, error: "Database query error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (!primaryProfiles || primaryProfiles.length === 0) {
    return new Response(
      JSON.stringify({ ok: true, processed_users: 0, reminders_sent: 0, skipped_invalid_timezone: 0 }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const now = new Date();
  let processedUsers = 0;
  let remindersSent = 0;
  let suppressedQuiet = 0;
  let skippedCompleted = 0;
  let skippedInvalidTimezone = 0;

  for (const profile of primaryProfiles) {
    try {
      // ─────────────────────────────────────────────────────────────────────
      // Strict timezone validation — NO UTC fallback.
      // If timezone is null, empty, whitespace, or an unrecognised IANA
      // identifier, skip this user's reminder evaluation entirely and log
      // an aggregate skip count. Never guess UTC or server timezone.
      // ─────────────────────────────────────────────────────────────────────
      if (!isValidTimezone(profile.timezone)) {
        console.warn(
          `User has missing or invalid timezone (value: ${JSON.stringify(profile.timezone)}). ` +
          `Skipping reminder evaluation. User must set a valid IANA timezone in their profile.`
        );
        skippedInvalidTimezone++;
        continue; // Do NOT process this user
      }

      const tz = (profile.timezone as string).trim();

      // Check for active push subscriptions
      const { count: subCount, error: countErr } = await adminClient
        .from("push_subscriptions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", profile.id);

      if (countErr || !subCount || subCount === 0) {
        continue;
      }

      // Fetch user's notification preferences (with safe defaults)
      const { data: prefRow } = await adminClient
        .from("notification_preferences")
        .select("*")
        .eq("user_id", profile.id)
        .maybeSingle();

      const prefs = {
        checkin_reminders_enabled: prefRow?.checkin_reminders_enabled ?? true,
        wind_down_reminders_enabled: prefRow?.wind_down_reminders_enabled ?? true,
        streak_reminders_enabled: prefRow?.streak_reminders_enabled ?? true,
        checkin_reminder_time: prefRow?.checkin_reminder_time ?? "20:00",
        wind_down_reminder_time: prefRow?.wind_down_reminder_time ?? "22:30",
        quiet_hours_enabled: prefRow?.quiet_hours_enabled ?? false,
        quiet_hours_start: prefRow?.quiet_hours_start ?? "22:00",
        quiet_hours_end: prefRow?.quiet_hours_end ?? "07:00",
      };

      // Resolve zoned time (throws on invalid timezone — caught below)
      let zoned;
      try {
        zoned = getZonedTime(now, tz);
      } catch {
        // Double-guard: isValidTimezone() should have caught this above.
        // If somehow execution reaches here, skip safely.
        console.warn(`Timezone "${tz}" passed validation but failed getZonedTime. Skipping.`);
        skippedInvalidTimezone++;
        continue;
      }

      processedUsers++;
      const { localDate, localYesterday, nowMins } = zoned;

      // Clean display name or nickname for personalization
      const girlName =
        (typeof profile.nickname === "string" && profile.nickname.trim().length > 0
          ? profile.nickname.trim()
          : null) ||
        (typeof profile.display_name === "string" && profile.display_name.trim().length > 0
          ? profile.display_name.trim()
          : null);

      // Evaluate Quiet Hours
      if (prefs.quiet_hours_enabled) {
        const qStart = parseTimeToMinutes(prefs.quiet_hours_start);
        const qEnd = parseTimeToMinutes(prefs.quiet_hours_end);
        if (qStart !== null && qEnd !== null && isQuiet(nowMins, qStart, qEnd)) {
          suppressedQuiet++;
          continue;
        }
      }

      // ─────────────────────────────────────────────────────────────────────
      // REMINDER 1: Evening Wind-down Reminder
      // Uses atomic claim → send → mark pattern to prevent concurrent duplicates.
      // ─────────────────────────────────────────────────────────────────────
      if (prefs.wind_down_reminders_enabled) {
        const windDownMins = parseTimeToMinutes(prefs.wind_down_reminder_time) ?? 1350; // default 22:30
        if (nowMins >= windDownMins) {
          // Check if wind-down session is already logged for today
          const { data: session } = await adminClient
            .from("wind_down_sessions")
            .select("id")
            .eq("user_id", profile.id)
            .eq("session_date", localDate)
            .maybeSingle();

          if (session) {
            skippedCompleted++;
          } else {
            const recentIndexes = await getRecentTemplateIndexes(adminClient, profile.id, "wind_down");
            const seed = hashString(`${profile.id}-${localDate}-wind_down`);
            const templateIndex = selectTemplateIndex("girl_winddown", recentIndexes, seed);
            const body = formatNotificationBody("girl_winddown", templateIndex, girlName);

            const payload: PushNotificationPayload = {
              title: "Nightly",
              body,
              url: "/wind-down",
              tag: "nightly-winddown",
            };

            const sent = await sendReminderAtomic(
              adminClient,
              profile.id,
              "wind_down",
              localDate,
              payload,
              vapidConfig,
              { template_index: templateIndex },
            );
            if (sent) remindersSent++;
          }
        }
      }

      // ─────────────────────────────────────────────────────────────────────
      // REMINDER 2: Daily Check-in, Streak, or Partner Check-on-Her Reminder
      // Uses atomic claim → send → mark pattern.
      // ─────────────────────────────────────────────────────────────────────
      const checkinMins = parseTimeToMinutes(prefs.checkin_reminder_time) ?? 1200; // default 20:00
      if (nowMins >= checkinMins) {
        // Check if check-in is already logged for today
        const { data: checkin } = await adminClient
          .from("daily_checkins")
          .select("id")
          .eq("user_id", profile.id)
          .eq("checkin_date", localDate)
          .maybeSingle();

        if (checkin) {
          skippedCompleted++;

          // ─────────────────────────────────────────────────────────────────
          // AUDIENCE 2: Partner Check-on-Her Reminder
          // Triggered when girl HAS completed her daily check-in, she has an
          // active partner relationship, and has sharing permissions enabled.
          // Partner notification NEVER exposes private sleep metrics.
          // ─────────────────────────────────────────────────────────────────
          try {
            const { data: relationship } = await adminClient
              .from("relationships")
              .select("partner_id")
              .eq("user_id", profile.id)
              .eq("status", "active")
              .maybeSingle();

            if (relationship?.partner_id) {
              const { data: perms } = await adminClient
                .from("sharing_permissions")
                .select("*")
                .eq("user_id", profile.id)
                .eq("partner_id", relationship.partner_id)
                .maybeSingle();

              const hasActiveSharing = perms && (
                perms.share_everything ||
                perms.share_sleep_duration ||
                perms.share_sleep_quality ||
                perms.share_exact_bedtime ||
                perms.share_exact_waketime ||
                perms.share_mood ||
                perms.share_energy ||
                perms.share_caffeine ||
                perms.share_phone_usage ||
                perms.share_naps ||
                perms.share_reasons ||
                perms.share_notes ||
                perms.share_insights ||
                perms.share_patterns ||
                perms.share_journal
              );

              if (hasActiveSharing) {
                const { data: partnerProfile } = await adminClient
                  .from("profiles")
                  .select("id, timezone, display_name, nickname")
                  .eq("id", relationship.partner_id)
                  .maybeSingle();

                if (partnerProfile && isValidTimezone(partnerProfile.timezone)) {
                  const partnerZoned = getZonedTime(now, (partnerProfile.timezone as string).trim());

                  const { data: partnerPrefRow } = await adminClient
                    .from("notification_preferences")
                    .select("*")
                    .eq("user_id", partnerProfile.id)
                    .maybeSingle();

                  const partnerPrefs = {
                    checkin_reminders_enabled: partnerPrefRow?.checkin_reminders_enabled ?? true,
                    checkin_reminder_time: partnerPrefRow?.checkin_reminder_time ?? "20:00",
                    quiet_hours_enabled: partnerPrefRow?.quiet_hours_enabled ?? false,
                    quiet_hours_start: partnerPrefRow?.quiet_hours_start ?? "22:00",
                    quiet_hours_end: partnerPrefRow?.quiet_hours_end ?? "07:00",
                  };

                  let partnerInQuiet = false;
                  if (partnerPrefs.quiet_hours_enabled) {
                    const pqStart = parseTimeToMinutes(partnerPrefs.quiet_hours_start);
                    const pqEnd = parseTimeToMinutes(partnerPrefs.quiet_hours_end);
                    if (pqStart !== null && pqEnd !== null && isQuiet(partnerZoned.nowMins, pqStart, pqEnd)) {
                      partnerInQuiet = true;
                    }
                  }

                  const partnerCheckinMins = parseTimeToMinutes(partnerPrefs.checkin_reminder_time) ?? 1200;

                  if (partnerPrefs.checkin_reminders_enabled && !partnerInQuiet && partnerZoned.nowMins >= partnerCheckinMins) {
                    const { count: partnerSubCount } = await adminClient
                      .from("push_subscriptions")
                      .select("id", { count: "exact", head: true })
                      .eq("user_id", partnerProfile.id);

                    if (partnerSubCount && partnerSubCount > 0) {
                      const partnerRecentIndexes = await getRecentTemplateIndexes(
                        adminClient,
                        partnerProfile.id,
                        "checkin",
                      );
                      const partnerSeed = hashString(`${partnerProfile.id}-${partnerZoned.localDate}-partner_checkin`);
                      const partnerTemplateIndex = selectTemplateIndex(
                        "partner_check_on_her",
                        partnerRecentIndexes,
                        partnerSeed,
                      );
                      const partnerBody = formatNotificationBody(
                        "partner_check_on_her",
                        partnerTemplateIndex,
                        girlName,
                      );

                      const partnerPayload: PushNotificationPayload = {
                        title: "Nightly",
                        body: partnerBody,
                        url: "/",
                        tag: "nightly-partner-checkin",
                      };

                      const partnerSent = await sendReminderAtomic(
                        adminClient,
                        partnerProfile.id,
                        "checkin",
                        partnerZoned.localDate,
                        partnerPayload,
                        vapidConfig,
                        { template_index: partnerTemplateIndex, partner_for: profile.id },
                      );
                      if (partnerSent) remindersSent++;
                    }
                  }
                }
              }
            }
          } catch (partnerErr: unknown) {
            console.warn(`Partner reminder check failed for girl ${profile.id}:`, partnerErr);
          }
        } else {
          // Check if user has an active streak (checked in yesterday)
          const { data: yesterdayCheckin } = await adminClient
            .from("daily_checkins")
            .select("id")
            .eq("user_id", profile.id)
            .eq("checkin_date", localYesterday)
            .maybeSingle();

          const hasActiveStreak = Boolean(yesterdayCheckin);

          if (prefs.streak_reminders_enabled && hasActiveStreak) {
            // Send Streak Reminder
            const recentIndexes = await getRecentTemplateIndexes(adminClient, profile.id, "streak");
            const seed = hashString(`${profile.id}-${localDate}-streak`);
            const templateIndex = selectTemplateIndex("girl_streak", recentIndexes, seed);
            const body = formatNotificationBody("girl_streak", templateIndex, girlName);

            const payload: PushNotificationPayload = {
              title: "Nightly",
              body,
              url: "/check-in",
              tag: "nightly-streak",
            };

            const sent = await sendReminderAtomic(
              adminClient,
              profile.id,
              "streak",
              localDate,
              payload,
              vapidConfig,
              { template_index: templateIndex },
            );
            if (sent) remindersSent++;
          } else if (prefs.checkin_reminders_enabled) {
            // Send Generic Daily Check-in Reminder
            const recentIndexes = await getRecentTemplateIndexes(adminClient, profile.id, "checkin");
            const seed = hashString(`${profile.id}-${localDate}-checkin`);
            const templateIndex = selectTemplateIndex("girl_checkin", recentIndexes, seed);
            const body = formatNotificationBody("girl_checkin", templateIndex, girlName);

            const payload: PushNotificationPayload = {
              title: "Nightly",
              body,
              url: "/check-in",
              tag: "nightly-checkin",
            };

            const sent = await sendReminderAtomic(
              adminClient,
              profile.id,
              "checkin",
              localDate,
              payload,
              vapidConfig,
              { template_index: templateIndex },
            );
            if (sent) remindersSent++;
          }
        }
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Error processing reminders";
      console.error(`Error processing reminders for user ${profile.id}:`, errMsg);
    }
  }

  // 8. Return aggregate safe summary
  return new Response(
    JSON.stringify({
      ok: true,
      processed_users: processedUsers,
      reminders_sent: remindersSent,
      suppressed_quiet: suppressedQuiet,
      skipped_completed: skippedCompleted,
      skipped_invalid_timezone: skippedInvalidTimezone,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
