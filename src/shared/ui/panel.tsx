/**
 * Tier 1 of the three surface tiers (`DEVDOCS/DESIGN.md` §3.4): a titled region
 * that owns its own actions.
 *
 * Deliberately **not** shadcn's `Card`: there is no `PanelDescription`. A panel
 * that needs a sentence explaining what it is has the wrong title, and a caption
 * under every heading is the pattern this shell was redesigned to remove.
 *
 * Padding is generous on purpose — the roominess of the reference lives at the
 * container level, while density lives inside data regions (§3.5). Use
 * `flush` for a panel whose body is a table, so rows can reach the border.
 */

import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/shared/lib/utils";

export function Panel({ className, ...props }: ComponentProps<"section">) {
  return (
    <section
      className={cn("rounded-lg border border-border bg-card text-card-foreground", className)}
      {...props}
    />
  );
}

/**
 * Title row. `actions` sits hard right; `meta` is a quiet figure that belongs to
 * the title itself (a count, a timestamp) and sits next to it.
 */
export function PanelHeader({
  title,
  meta,
  actions,
  className,
}: {
  title: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex h-12 items-center gap-3 border-b border-border px-5", className)}>
      <h2 className="truncate text-sm font-medium tracking-tight">{title}</h2>
      {meta ? <span className="shrink-0 text-xs text-muted-foreground">{meta}</span> : null}
      {actions ? <div className="ml-auto flex shrink-0 items-center gap-1.5">{actions}</div> : null}
    </header>
  );
}

export function PanelBody({
  className,
  flush = false,
  ...props
}: ComponentProps<"div"> & { flush?: boolean }) {
  return <div className={cn(flush ? "" : "px-5 py-4", className)} {...props} />;
}
