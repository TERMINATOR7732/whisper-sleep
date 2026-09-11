# Whisper Sleep

PRIVATE SLEEP COMPANION — FOUNDATION

Build the foundation of a private, mobile-first sleep companion web application.

This is NOT a generic commercial sleep tracker.

The product is designed for two people:

The primary user ("Her") records her own sleep, lifestyle, mood, energy and related information.

Her partner ("Me") can optionally view information that she explicitly chooses to share.

The app should feel:

warm

personal

calm

modern

supportive

slightly romantic

mature

not clinical

not like a medical dashboard

not like a corporate analytics dashboard

The long-term goal is to help the primary user understand her sleep patterns and gradually improve her sleep routine, while allowing her partner to support her when she explicitly enables sharing.

IMPORTANT:
Do NOT build all future features yet.
This prompt is ONLY for the foundation.

TECHNOLOGY

Use:

React

TypeScript

Tailwind CSS

shadcn/ui

Supabase

PostgreSQL

Supabase Authentication

Supabase Row Level Security

Structure the project cleanly so additional features can be added later without rewriting the application.

Do not introduce unnecessary frameworks or libraries.

Use environment variables for Supabase configuration.

USER TYPES

There are two account roles:

USER
The primary sleep-tracking user.

PARTNER
The person connected to the primary user.

Do not create an unrestricted administrator role.

The partner is NOT an admin and must never automatically have access to private user information.

AUTHENTICATION

Implement real Supabase authentication.

Create:

Sign up

Login

Logout

Forgot password

Password reset

Persistent authentication session

Protected routes

Authentication state handling

Loading states

Error states

Do NOT use fake authentication.
Do NOT hardcode accounts.
Do NOT store passwords manually.

After signup, the user should be taken through a basic profile setup.

PROFILE

Create a profiles table connected to the authenticated Supabase user.

Fields:

id

display_name

nickname

role

timezone

avatar_url

created_at

updated_at

The role must only allow:

user

partner

Use the authenticated user's ID as the primary identity.

DATABASE FOUNDATION

Create the following initial tables:

profiles

id UUID primary key

display_name

nickname

role

timezone

avatar_url

created_at

updated_at

relationships

Used to connect a primary user and their partner.

Fields:

id UUID primary key

user_id

partner_id

status

created_at

updated_at

Relationship status:

pending

active

disconnected

sharing_permissions

This controls exactly what the primary user allows the partner to see.

Fields:

id

user_id

partner_id

share_sleep_duration

share_sleep_quality

share_exact_bedtime

share_exact_waketime

share_mood

share_energy

share_caffeine

share_phone_usage

share_naps

share_reasons

share_notes

share_insights

share_patterns

share_journal

share_everything

created_at

updated_at

Set sensible defaults, but do NOT assume that the partner should automatically receive private information.

The primary user must always be able to revoke sharing.

SECURITY / RLS

This is extremely important.

Implement Supabase Row Level Security correctly.

Requirements:

A user can access their own profile.

A partner cannot access arbitrary user profiles.

A user can manage their own sharing permissions.

A partner can only access information that the primary user has explicitly shared.

Never rely on frontend checks alone for privacy.

Database policies must enforce access.

Do not create insecure policies such as:

"authenticated users can select everything."

Do not expose service-role credentials in frontend code.

ROUTING

Create protected route structure.

Primary user navigation:

Home

Check-in

Insights

Reset

Profile

Partner navigation:

Dashboard

Trends

Patterns

Messages

Profile

For now, the pages can contain polished placeholder states explaining that these features will be added in later development stages.

Do NOT implement the actual sleep tracker, pattern engine, analytics or AI yet.

ONBOARDING

After signup, show a simple onboarding flow.

Ask:

What should we call you?

What is your preferred nickname?

What timezone are you in?

Are you the primary user or partner?

If the account is a primary user, prepare the account for the future sleep-tracking features.

If the account is a partner, prepare the account for the future partner dashboard.

Do not ask unnecessary personal questions at this stage.

DESIGN SYSTEM

Create a reusable design system.

Use:

rounded cards

soft shadows

clean typography

generous spacing

subtle animations

responsive layouts

accessible buttons and form controls

clear empty states

friendly error states

The application must work beautifully on:

mobile phones

tablets

desktop

Design mobile-first.

The eventual primary experience will be used mostly from a phone.

Avoid excessive gradients, excessive glassmorphism, or overly flashy UI.

The design should feel premium and personal.

HOME PAGE FOUNDATION

For the primary user, create a preliminary Home page.

Example structure:

Greeting:

"Good morning ❤️"

Then an empty sleep summary card:

"Your sleep summary will appear here."

Then placeholder sections for:

Sleep

Energy

Mood

Today's focus

Insights

Do not invent sleep data.

If there is no data, clearly show an empty state.

PARTNER DASHBOARD FOUNDATION

Create the preliminary partner Dashboard.

Show:

"Her Sleep"

Then empty states for:

Current status

Last sleep

Sleep duration

Energy

Mood

Recent pattern

Because no sharing data exists yet, clearly communicate that shared information will appear only after the primary user connects the partner and grants permission.

PROFILE SETTINGS

Create a Profile page with:

Display name

Nickname

Timezone

Account role

Logout

Prepare the page for future settings such as:

sleep goals

notification preferences

privacy

sharing permissions

appearance

data export

data deletion

Do not implement those future settings yet.

CODE QUALITY

Use reusable components.

Avoid putting everything into one huge component.

Use a sensible structure such as:

components/
lib/
hooks/
types/
pages/routes/

Keep Supabase access centralized and clean.

Use TypeScript types for database entities.

Handle:

loading

errors

empty states

authentication state

Do not use mock data once real Supabase functionality is available.

IMPORTANT DEVELOPMENT RULE

This is the FOUNDATION stage.

Do not implement:

sleep tracking

naps

daily check-ins

caffeine logging

phone tracking

pattern detection

analytics

sleep reset

experiments

AI

notifications

journal

achievements

weekly reports

Those will be implemented in later stages.

The goal of this stage is to establish a clean, secure, beautiful foundation that we can build on without breaking previous functionality.

Before finishing, verify that:

Signup works.

Login works.

Logout works.

Protected routes work.

User profiles are created.

Roles work.

Supabase database tables exist.

RLS policies are enabled.

A partner cannot access arbitrary private user data.

The application works on mobile and desktop.

Do not claim something is implemented unless it actually works.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/8ddd59ac-a654-45f1-b920-ecf55fff1376).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
