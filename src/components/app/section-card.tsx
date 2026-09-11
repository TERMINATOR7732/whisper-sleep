import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function SectionCard({
  title,
  icon: Icon,
  hint,
  children,
  className,
}: {
  title: string;
  icon?: LucideIcon;
  hint?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "card-soft fade-rise p-5 transition-shadow duration-300 hover:shadow-lift sm:p-6",
        className,
      )}
    >
      <header className="flex items-center gap-2.5">
        {Icon ? <Icon className="size-4 text-primary" aria-hidden="true" /> : null}
        <h2 className="text-sm font-semibold tracking-wide text-foreground uppercase">{title}</h2>
      </header>
      {hint ? <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{hint}</p> : null}
      {children ? <div className="mt-4">{children}</div> : null}
    </section>
  );
}

export function PlaceholderRow({ label, note }: { label: string; note: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-1 border-b border-border/70 py-3 last:border-0">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <span className="text-sm text-muted-foreground">{note}</span>
    </div>
  );
}
