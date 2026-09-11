import { createFileRoute, Link } from "@tanstack/react-router";
import { Heart, Lock, Moon, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { homeFor } from "@/components/app/nav-config";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Nightly — A private sleep companion for two" },
      {
        name: "description",
        content:
          "A calm, private space to understand your sleep — and to let the person who cares about you support you, only with what you choose to share.",
      },
      { property: "og:title", content: "Nightly — A private sleep companion for two" },
      {
        property: "og:description",
        content:
          "A calm, private space to understand your sleep, with sharing that stays entirely in your hands.",
      },
    ],
  }),
  component: Landing,
});

const POINTS = [
  {
    icon: Moon,
    title: "Gentle by design",
    body: "No streaks, no scores, no clinical charts. Just a quiet place to notice how your nights are going.",
  },
  {
    icon: Lock,
    title: "Private unless you say so",
    body: "Nothing is shared by default. You choose each detail your partner can see, and you can turn it off any time.",
  },
  {
    icon: Heart,
    title: "Support, not surveillance",
    body: "Your partner sees only what you allow — enough to be helpful, never enough to intrude.",
  },
];

function Landing() {
  const { user, loading } = useAuth();
  const { data: profile } = useProfile();

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
        <span className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-full bg-secondary text-primary">
            <Moon className="size-4" aria-hidden="true" />
          </span>
          <span className="font-display text-lg">Nightly</span>
        </span>
        {loading ? null : user ? (
          <Button asChild size="sm">
            <Link to={homeFor(profile?.role ?? "user")}>Open the app</Link>
          </Button>
        ) : (
          <Button asChild size="sm" variant="ghost">
            <Link to="/auth">Sign in</Link>
          </Button>
        )}
      </header>

      <main className="mx-auto max-w-5xl px-5 pb-20">
        <section className="fade-rise py-12 sm:py-20">
          <p className="text-sm tracking-widest text-primary uppercase">A private sleep companion</p>
          <h1 className="mt-4 max-w-2xl font-display text-4xl leading-[1.1] sm:text-6xl">
            Sleep, understood softly — and shared only with the person you choose.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Nightly is built for two people: one who tracks her nights, and one who wants to help.
            Everything begins private, and stays that way until she decides otherwise.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/auth">{user ? "Continue" : "Create your space"}</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/auth">I already have an account</Link>
            </Button>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          {POINTS.map((point) => (
            <article key={point.title} className="card-soft fade-rise p-6">
              <point.icon className="size-5 text-primary" aria-hidden="true" />
              <h2 className="mt-4 text-lg">{point.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{point.body}</p>
            </article>
          ))}
        </section>

        <section className="card-soft mt-4 flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg">
              <Sparkles className="size-4 text-primary" aria-hidden="true" /> Early foundation
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Accounts, profiles and privacy controls are ready. Sleep tracking and insights arrive next.
            </p>
          </div>
          <Button asChild variant="secondary">
            <Link to="/auth">Get started</Link>
          </Button>
        </section>
      </main>
    </div>
  );
}
