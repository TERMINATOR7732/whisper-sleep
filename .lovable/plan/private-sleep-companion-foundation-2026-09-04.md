# Private Sleep Companion — Foundation

A warm, calm, mobile-first sleep companion for two people: the primary user ("Her") who will track sleep, and her partner ("Me") who sees only what she explicitly shares. This stage builds the secure, beautiful shell — no tracking, analytics, or AI yet.

## What gets built

**Backend (Lovable Cloud)**

- `profiles`: id (auth user id), display_name, nickname, role (`user` | `partner`), timezone, avatar_url, timestamps. Auto-created on signup via trigger.
- `relationships`: user_id, partner_id, status (`pending` | `active` | `disconnected`), timestamps.
- `sharing_permissions`: user_id, partner_id, one boolean per shareable item (sleep duration, quality, exact bedtime/waketime, mood, energy, caffeine, phone usage, naps, reasons, notes, insights, patterns, journal, share_everything), timestamps. All default to off.
- Row Level Security on every table, plus explicit grants:
  - Everyone reads/updates only their own profile.
  - A partner may read the primary user's profile only through an `active` relationship (enforced by a security-definer helper function, no recursive policies).
  - Only the primary user can create or change sharing permissions; the partner can read them but never write. Revoking is instant.
  - No "authenticated can select everything" policies, no admin role, no service key in the browser.

**Auth**

- Real Cloud auth: email/password sign up, login, logout, forgot password, `/reset-password` page, persistent session, loading + error states.
- Google sign-in included alongside email/password.
- Protected route layout; unauthenticated visitors go to the auth page.
- Session-aware header (account menu + sign out), correct sign-out cleanup.

**Onboarding (after signup)**
Single calm flow: name, nickname, timezone (auto-detected, editable), and role (primary user or partner). Saves to the profile, then routes to the correct home. Users who already finished onboarding skip it.

**Routes**

- Public: landing page at `/` with sign-in call to action, `/auth`, `/reset-password`.
- Primary user: Home, Check-in, Insights, Reset, Profile.
- Partner: Dashboard, Trends, Patterns, Messages, Profile.
- Role-aware navigation (bottom tab bar on phones, side nav on desktop). A user landing on the other role's route is redirected to their own home.

**Screens**

- Home: time-aware greeting ("Good morning ❤️"), empty sleep summary card, and calm placeholder sections for Sleep, Energy, Mood, Today's focus, Insights. No invented data.
- Partner Dashboard: "Her Sleep" with empty cards for current status, last sleep, duration, energy, mood, recent pattern, plus a clear note that shared info appears only after she connects the partner and grants permission.
- Check-in / Insights / Reset / Trends / Patterns / Messages: polished "coming in a later stage" placeholder states.
- Profile: display name, nickname, timezone, account role, logout, and visibly disabled-for-now sections for sleep goals, notifications, privacy & sharing, appearance, data export, data deletion.

**Design system**
Warm, personal, mature: soft off-white/dusk palette with a muted rose-and-indigo accent, expressive display font paired with a clean text font, rounded cards, soft shadows, generous spacing, subtle motion. All colors as semantic tokens in `src/styles.css` — no hardcoded colors, no heavy gradients or glassmorphism. Mobile-first, works up through desktop. Light and dark themes.

## Technical notes

- TanStack Start + React + TypeScript + Tailwind + shadcn/ui, Cloud (Supabase) for database/auth. No extra frameworks.
- Structure: `src/routes/` (public routes, `_authenticated/` gated subtree), `src/components/` (design-system + feature components), `src/hooks/`, `src/lib/`, `src/types/`. Supabase access stays centralized in generated clients plus small typed data helpers; generated DB types used throughout.
- Profile reads/writes go through authenticated server functions or the RLS-scoped browser client — never a service-role key on the client.
- Every data surface handles loading, error, empty, and unauthenticated states.

## Verification before finishing

Sign up, onboard, log in, log out, password reset, protected-route redirects, role-based navigation, profile auto-creation and edits, tables and RLS present, a partner query for an unshared user's data returns nothing, and mobile + desktop layouts checked in the running app.P