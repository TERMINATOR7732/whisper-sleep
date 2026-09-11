import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Moon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Set a new password — Nightly" },
      { name: "description", content: "Choose a new password for your Nightly account." },
      { property: "og:title", content: "Set a new password — Nightly" },
      { property: "og:description", content: "Choose a new password for your Nightly account." },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    toast.success("Password updated");
    navigate({ to: "/onboarding", replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-5 py-12">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-full bg-secondary text-primary">
            <Moon className="size-4" aria-hidden="true" />
          </span>
          <span className="font-display text-lg">Nightly</span>
        </Link>
        <form onSubmit={onSubmit} className="card-soft fade-rise space-y-4 p-6 sm:p-7">
          <div>
            <h1 className="font-display text-2xl">Set a new password</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Open this page from the link we emailed you, then choose a new password.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              minLength={6}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Saving…" : "Save password"}
          </Button>
          <Link to="/auth" className="block text-center text-sm text-muted-foreground hover:underline">
            Back to sign in
          </Link>
        </form>
      </div>
    </div>
  );
}
