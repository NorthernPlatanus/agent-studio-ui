/**
 * Tier 3 (`DEVDOCS/DESIGN.md` §3.4): a heading and its content, directly on the
 * page background. **No card.**
 *
 * This is what tables, timelines and logs use. Wrapping a two-hundred-row table
 * in a rounded box is the tell the redesign removes: card chrome should mean
 * "this is a discrete thing", and a table is the page.
 */

import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";

export function SectionHeading({
  children,
  meta,
  actions,
  className,
}: {
  children: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-7 items-center gap-2.5", className)}>
      <h2 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {children}
      </h2>
      {meta ? <span className="text-[11px] text-muted-foreground/70">{meta}</span> : null}
      {actions ? <div className="ml-auto flex items-center gap-1.5">{actions}</div> : null}
    </div>
  );
}

export function Region({
  title,
  meta,
  actions,
  children,
  className,
}: {
  title: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-2.5", className)}>
      <SectionHeading meta={meta} actions={actions}>
        {title}
      </SectionHeading>
      {children}
    </section>
  );
}

/**
 * The "nothing here" state. One line, no card, no apology — an empty queue is a
 * normal reading of the data, not a degraded page.
 */
export function EmptyState({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        "rounded-md border border-dashed border-border px-4 py-6 text-center text-[13px] text-muted-foreground",
        className,
      )}
    >
      {children}
    </p>
  );
}
