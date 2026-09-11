import { createFileRoute } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";

import { PageHeader } from "@/components/app/app-shell";
import { ComingSoon } from "@/components/app/coming-soon";
import { RoleGate } from "@/components/app/role-gate";

export const Route = createFileRoute("/_authenticated/messages")({
  head: () => ({
    meta: [
      { title: "Messages — Nightly" },
      { name: "description", content: "Small notes of encouragement between the two of you, coming soon." },
      { property: "og:title", content: "Messages — Nightly" },
      { property: "og:description", content: "Small notes of encouragement between the two of you." },
    ],
  }),
  component: () => (
    <RoleGate role="partner">
      <div className="space-y-4">
        <PageHeader title="Messages" subtitle="A place for small, warm notes — nothing demanding." />
        <ComingSoon
          icon={MessageCircle}
          title="Notes arrive later"
          description="You'll be able to leave a short message she reads whenever she likes. No pressure, no notifications she didn't ask for."
          items={["Short notes of encouragement", "Read whenever she wants", "Always optional", "Private to the two of you"]}
        />
      </div>
    </RoleGate>
  ),
});
