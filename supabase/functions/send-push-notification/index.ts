import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import { sendPushToUser, type PushNotificationPayload, type VapidConfig } from "../_shared/push.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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

  // 3. Authenticate caller via Supabase Auth
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response(
      JSON.stringify({ ok: false, error: "Missing or malformed Authorization header" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_ANON_KEY in function environment");
    return new Response(
      JSON.stringify({ ok: false, error: "Server configuration error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Instantiate Supabase client scoped to caller's JWT (enforcing PostgreSQL RLS)
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) {
    return new Response(
      JSON.stringify({ ok: false, error: "Invalid or expired authorization token" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // 4. Parse and validate request payload
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

  // Reject prohibited and sensitive fields
  if ("user_id" in body || "userId" in body) {
    return new Response(
      JSON.stringify({ ok: false, error: "Specifying user_id is prohibited. Requests target the authenticated user only." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if ("vapid" in body || "privateKey" in body || "keys" in body || "subscription" in body) {
    return new Response(
      JSON.stringify({ ok: false, error: "Client-supplied credentials or subscriptions are prohibited." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Extract and sanitize fields with safe defaults
  const rawTitle = typeof body["title"] === "string" ? body["title"].trim() : "Nightly";
  const rawBody = typeof body["body"] === "string" ? body["body"].trim() : "This is a test notification.";
  const rawUrl = typeof body["url"] === "string" ? body["url"].trim() : "/home";
  const rawTag = typeof body["tag"] === "string" ? body["tag"].trim() : undefined;

  // Strict length validation
  if (rawTitle.length === 0 || rawTitle.length > 100) {
    return new Response(
      JSON.stringify({ ok: false, error: "Title must be between 1 and 100 characters" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (rawBody.length > 250) {
    return new Response(
      JSON.stringify({ ok: false, error: "Body cannot exceed 250 characters" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (rawTag && rawTag.length > 50) {
    return new Response(
      JSON.stringify({ ok: false, error: "Tag cannot exceed 50 characters" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Reject executable or HTML tags to prevent cross-site scripting
  const dangerousPattern = /<[^>]*>|javascript:/i;
  if (dangerousPattern.test(rawTitle) || dangerousPattern.test(rawBody) || (rawTag && dangerousPattern.test(rawTag))) {
    return new Response(
      JSON.stringify({ ok: false, error: "Executable or HTML content is not permitted" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Enforce relative same-origin URL starting with '/'
  if (!rawUrl.startsWith("/") || rawUrl.startsWith("//") || rawUrl.includes("\\")) {
    return new Response(
      JSON.stringify({ ok: false, error: "URL must be a safe relative path starting with /" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // 5. Load server-side VAPID secrets
  const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:support@nightly.app";
  const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY") || Deno.env.get("VITE_VAPID_PUBLIC_KEY");

  if (!vapidPrivateKey || !vapidPublicKey) {
    console.error("VAPID server secrets are missing in Edge Function environment");
    return new Response(
      JSON.stringify({ ok: false, error: "Server VAPID credentials are not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // 6. Deliver notification via shared push helper
  try {
    const payload: PushNotificationPayload = {
      title: rawTitle,
      body: rawBody,
      url: rawUrl,
      tag: rawTag,
    };

    const vapid: VapidConfig = {
      subject: vapidSubject,
      publicKey: vapidPublicKey,
      privateKey: vapidPrivateKey,
    };

    const result = await sendPushToUser(userClient, user.id, payload, vapid);

    return new Response(
      JSON.stringify({
        ok: true,
        sent: result.sent,
        removed: result.removed,
        ...(result.totalSubscriptions === 0 ? { message: "No active push subscriptions found for this user." } : {}),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : "Internal push sending failure";
    console.error("sendPushToUser failure:", errMsg);
    return new Response(
      JSON.stringify({ ok: false, error: "Failed to deliver push notification" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
