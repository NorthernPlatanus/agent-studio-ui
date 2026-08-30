/**
 * Tier 1 of the three surface tiers (`devdocs/DESIGN.md` §3.4): a titled region
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

/**
 * `fill` makes the panel a flex column that consumes its parent's height, so a
 * header and a footer can be pinned while exactly one region between them
 * scrolls. Only legal under a `Screen fill` (see `screen.tsx`) — a fill panel in
 * a scrolling page has no height to consume and collapses.
 */
export function Panel({
  className,
  fill = false,
  ...props
}: ComponentProps<"section"> & { fill?: boolean }) {
  return (
    <section
      className={cn(
        "rounded-lg border border-border bg-card text-card-foreground",
        fill && "flex min-h-0 flex-1 flex-col overflow-hidden",
        className,
      )}
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
    // `min-w-0` on both text slots is load-bearing, not defensive: a flex item
    // defaults to `min-width: auto`, so without it `truncate` never engages and
    // the row grows past its container instead of ellipsing. That is what pushed
    // the planner's status chip and Close button 96px outside the work column at
    // 375px — a 1.4.10 reflow failure, not a cosmetic one.
    <header className={cn("flex h-12 items-center gap-3 border-b border-border px-5", className)}>
      {/*
        The title keeps its width and the meta absorbs the squeeze. Both had
        plain `min-w-0`, so a tight header shrank them in proportion to their
        content and the *title* lost characters first: the planner's specs panel
        at 22rem read "Proposed spe…" beside a fully-legible "3 tasks · 5
        candidate attempts if approved". When a header runs out of room the
        expendable half is the count, not the name of the panel.

        `shrink-0` alone would let a long title overflow, so it is capped at
        half the header and still truncates past that — a weighted `shrink`
        was tried first and is not enough: at any factor above zero the title
        still gives up the few pixels that cost it its last word.
      */}
      <h2 className="min-w-0 max-w-[50%] shrink-0 truncate text-sm font-medium tracking-tight">
        {title}
      </h2>
      {meta ? <span className="min-w-0 truncate text-xs text-muted-foreground">{meta}</span> : null}
      {actions ? <div className="ml-auto flex shrink-0 items-center gap-1.5">{actions}</div> : null}
    </header>
  );
}

export function PanelBody({
  className,
  flush = false,
  scroll = false,
  ...props
}: ComponentProps<"div"> & { flush?: boolean; scroll?: boolean }) {
  return (
    <div
      className={cn(
        flush ? "" : "px-5 py-4",
        scroll && "min-h-0 flex-1 overflow-y-auto",
        className,
      )}
      {...props}
    />
  );
}

/**
 * The pinned foot of a `fill` panel: the controls that act on whatever is
 * scrolling above them.
 *
 * `shrink-0` rather than a height — the planner's action zone is a textarea in
 * one state and a wrapping row of three buttons in another, and pinning it to a
 * fixed height would clip the taller one.
 */
export function PanelFooter({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("shrink-0 border-t border-border px-5 py-3", className)} {...props} />;
}
