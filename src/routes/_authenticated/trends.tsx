import { createFileRoute } from "@tanstack/react-router";
import { BarChart3 } from "lucide-react";

import { PageHeader } from "@/components/app/app-shell";
import { ComingSoon } from "@/components/app/coming-soon";
import { RoleGate } from "@/components/app/role-gate";

export const Route = createFileRoute("/_authenticated/trends")({
  head: () => ({
    meta: [
      { title: "Trends — Nightly" },
      { name: "description", content: "Shared trends over time, once she chooses to share them." },
      { property: "og:title", content: "Trends — Nightly" },
      { property: "og:description", content: "Shared trends over time, once she chooses to share them." },
    ],
  }),
  component: () => (
    <RoleGate role="partner">
      <div className="space-y-4">
        <PageHeader title="Trends" subtitle="The bigger picture — only ever what she shares." />
        <ComingSoon
          icon={BarChart3}
          title="No shared history yet"
          description="When she shares her nights, you'll see soft week-by-week trends here instead of raw numbers."
          items={[
            "Rest over the past weeks",
            "Better and harder nights",
            "Simple, non-clinical summaries",
            "Only the details she enables",
          ]}
        />
      </div>
    </RoleGate>
  ),
});
