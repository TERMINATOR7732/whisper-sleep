import { createFileRoute } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";

import { PageHeader } from "@/components/app/app-shell";
import { ComingSoon } from "@/components/app/coming-soon";
import { RoleGate } from "@/components/app/role-gate";

export const Route = createFileRoute("/_authenticated/insights")({
  head: () => ({
    meta: [
      { title: "Insights — Nightly" },
      { name: "description", content: "Plain-language observations about your nights, coming soon." },
      { property: "og:title", content: "Insights — Nightly" },
      { property: "og:description", content: "Plain-language observations about your nights." },
    ],
  }),
  component: () => (
    <RoleGate role="user">
      <div className="space-y-4">
        <PageHeader title="Insights" subtitle="Gentle observations, written like a friend would say them." />
        <ComingSoon
          icon={Sparkles}
          title="Nothing to notice yet"
          description="Once a few nights are recorded, Nightly will start pointing out what seems to help and what doesn't."
          items={[
            "What helps you fall asleep",
            "What tends to disrupt a night",
            "Gentle weekly summaries",
            "Small, doable suggestions",
          ]}
        />
      </div>
    </RoleGate>
  ),
});
