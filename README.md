# Whisper Sleep — Nightly

A calm, private, mobile-first sleep companion web application designed specifically for two people:
- **The Primary User ("Her")**: Tracks and reflects on her sleep, daily habits, energy, and mood in a quiet, distraction-free environment.
- **The Partner ("Me")**: Quietly supports her, seeing only what she explicitly chooses to share — nothing more, nothing by default.

---

## Architecture Overview

- **Frontend**: React 19 + TypeScript + Vite + TanStack Start (SSR) + TanStack Router + Tailwind CSS + Radix UI / shadcn/ui.
- **Backend & Database**: Supabase (PostgreSQL) with strict Row Level Security (RLS) policies on every table.
- **PWA & Notifications**: W3C Web App Manifest (`/manifest.webmanifest`), Service Worker (`public/sw.js`), Web Push (VAPID, RFC 8291/8292).
- **Serverless Automation**: Supabase Edge Functions (Deno) triggered on-demand and via scheduled database cron (`pg_cron` + `pg_net`).

---

## Two-Person Privacy Model

Privacy is the foundational design constraint of Whisper Sleep / Nightly:
1. **Zero Default Access**: When paired, all granular sharing permissions default to `false`.
2. **Direct Table Protection**: Partner accounts can **never** directly SELECT, INSERT, UPDATE, or DELETE primary user records from `sleep_entries`, `daily_checkins`, `naps`, `sleep_reasons`, `sleep_reset_plans`, or `wind_down_sessions`.
3. **Mediated Shared Access**: Partner access to sleep information is strictly mediated through `SECURITY DEFINER` functions (`get_shared_sleep_days`, `get_shared_reset_plan`, `get_shared_recovery_status`) that:
   - Verify the viewer is actively connected (`is_actively_linked(viewer, user) = true`).
   - Check the specific granular permission flag for that field. If disabled, the field is stripped via `jsonb_strip_nulls`.
4. **Immediate Disconnect Revocation**: Disconnecting immediately sets relationship status to `disconnected`, causing `is_actively_linked` to return `false` and instantly revoking all shared views.

---

## Core Systems

### 1. Authentication & Role Routing
- Real Supabase email authentication with password reset support.
- Role-based routing:
  - Unauthenticated users: redirected to `/auth`.
  - Primary users (`role: 'user'`): routed to `/home` (sleep tracking, streak counter, check-in).
  - Partner users (`role: 'partner'`): routed to `/dashboard` (support view, shared sleep cards).
- Route guards (`RoleGate`) enforce role isolation across all protected routes.

### 2. Partner Pairing
- Primary user generates a unique 8-character invite code (`useCreatePartnerInvite`).
- Partner enters the code to pair (`accept_partner_invite`).
- Self-pairing, expired codes, cancelled codes, and reuse of codes are strictly rejected.
- Either party can disconnect at any time via `disconnect_partner()`.

### 3. Granular Sharing
Primary user can independently toggle:
- Sleep duration
- Sleep quality
- Exact bedtime & wake time
- Mood, energy, & caffeine
- Phone usage & naps
- Sleep reasons & notes
- Reset plan schedule & recovery status

### 4. Streak System
- Evaluated dynamically in the user's configured profile timezone (`get_my_streak()`).
- Derived from continuous daily check-ins without mutable database counters.
- Private to the primary user.

### 5. Progressive Web App (PWA) & Web Push
- Installable PWA with standalone display and mobile icon assets.
- `public/sw.js` handles `push` and `notificationclick` events:
  - No intrusive fetch interception or caching of sensitive authentication tokens.
  - Safe navigation sanitized strictly to the application origin.
  - Automatic cleanup of expired subscriptions on HTTP 404/410.

### 6. Automated Push Notifications
- Supabase Edge Function `process-notification-reminders` evaluates reminder eligibility:
  - **Check-in Reminder**: Scheduled in local time; suppressed if today's check-in is already complete.
  - **Wind-down Reminder**: Scheduled in local time; suppressed if today's wind-down session is logged.
  - **Streak Reminder**: Dispatched only when an active streak exists and today's check-in is pending.
  - **Quiet Hours**: Suppresses all reminders during configured sleep hours (supports midnight-crossing spans like `22:00` to `07:00`).
  - **Strict Timezone Safety**: Non-valid, NULL, or empty timezones are skipped safely without UTC fallback.
  - **Atomic Idempotency**: Database claim tokens (`claim_notification_slot`) ensure exactly one push attempt occurs across concurrent cron executions.
  - **Partner Exclusion**: Automated reminders target primary users only; partners receive zero notifications.

---

## Environment Variables

Copy `.env.example` to `.env` or set these in your hosting environment:

### Frontend / Client-Side (Exposed in browser bundle)
```env
# Supabase Project URL & Anon/Publishable Key
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-anon-key

# Web Push VAPID Public Key (applicationServerKey)
VITE_VAPID_PUBLIC_KEY=your-vapid-public-key-here
```

### Server-Side / Supabase Edge Functions (NEVER expose to client)
```env
# Web Push VAPID Private Signing Key
VAPID_PRIVATE_KEY=your-vapid-private-key-here
VAPID_SUBJECT=mailto:support@nightly.app

# Scheduler Auth Secret (used by pg_cron / pg_net)
CRON_SECRET=your-scheduler-cron-secret-here
```

---

## Local Development

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start development server**:
   ```bash
   npm run dev
   ```
   Opens at `http://localhost:8080/`.

3. **Type check & Build**:
   ```bash
   npx tsc --noEmit
   npm run build
   ```

---

## Production Deployment (Vercel)

Whisper Sleep / Nightly uses TanStack Start with Vite and Nitro for SSR.

### Vercel Setup:
1. Connect the GitHub repository to Vercel.
2. In Project Settings:
   - **Framework Preset**: Other
   - **Build Command**: `npm run build`
   - **Environment Variables**:
     - `NITRO_PRESET`: `vercel`
     - `VITE_SUPABASE_URL`: `https://<project-ref>.supabase.co`
     - `VITE_SUPABASE_PUBLISHABLE_KEY`: `<anon-key>`
     - `VITE_VAPID_PUBLIC_KEY`: `<vapid-public-key>`
3. Nitro automatically emits the Vercel Build Output API v3 (`.vercel/output/`) with serverless function routing.

---

## Security Best Practices

- **Zero Client Secrets**: VAPID private keys, `service_role` keys, database passwords, and scheduler secrets are strictly excluded from all client bundles and repository tracking.
- **Strict RLS**: Every database table enforces Row Level Security.
- **Defensive Functions**: All database RPCs use `SECURITY DEFINER` with fixed `search_path = public` and explicit privilege revoking from `PUBLIC` and `anon`.
