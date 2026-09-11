import type { LucideIcon } from "lucide-react";

import { EmptyState } from "./empty-state";

export function ComingSoon({
  icon,
  title,
  description,
  items,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  items: string[];
}) {
  return (
    <div className="card-soft fade-rise overflow-hidden">
      <EmptyState icon={icon} title={title} description={description} />
      <ul className="grid gap-2 border-t border-border/70 bg-secondary/40 p-5 sm:grid-cols-2 sm:p-6">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
            <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary/60" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
