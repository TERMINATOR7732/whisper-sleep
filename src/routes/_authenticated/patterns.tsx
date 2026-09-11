import { createFileRoute } from "@tanstack/react-router";
import { Activity } from "lucide-react";

import { PageHeader } from "@/components/app/app-shell";
import { ComingSoon } from "@/components/app/coming-soon";
import { RoleGate } from "@/components/app/role-gate";

export const Route = createFileRoute("/_authenticated/patterns")({
  head: () => ({
    meta: [
      { title: "Patterns — Nightly" },
      { name: "description", content: "Shared patterns that help you support her, when she allows it." },
      { property: "og:title", content: "Patterns — Nightly" },
      { property: "og:description", content: "Shared patterns that help you support her, when she allows it." },
    ],
  }),
  component: () => (
    <RoleGate role="partner">
      <div className="space-y-4">
        <PageHeader title="Patterns" subtitle="What tends to help her sleep — in her words, with her consent." />
        <ComingSoon
          icon={Activity}
          title="No patterns shared yet"
          description="Patterns need history, and history needs her permission. Nothing appears here until both exist."
          items={[
            "What seems to help",
            "What tends to disrupt",
            "Gentle ways to support her",
            "Nothing without her consent",
          ]}
        />
      </div>
    </RoleGate>
  ),
});
