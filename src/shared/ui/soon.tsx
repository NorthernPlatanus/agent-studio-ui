/**
 * The "not wired up yet" plug (`DEVDOCS/DESIGN.md` §3.8).
 *
 * An unbuilt screen still ships its real layout — what is missing is the data
 * source, and saying so precisely is more useful than a grey box that says
 * "arrives in phase 3". Two forms:
 *
 *  - `<Soon />` — a chip beside a heading: the region is real, its data is not.
 *  - `<SoonOverlay>` — wraps a laid-out region that is entirely a preview.
 */

import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";

export function Soon({ label = "Soon", title }: { label?: string; title?: string }) {
  return (
    <span
      title={title ?? "Designed, not wired up yet"}
      className="inline-flex shrink-0 items-center rounded border border-dashed border-border px-1.5 py-px text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
    >
      {label}
    </span>
  );
}

/**
 * Dims and disables its children, and states what is missing.
 *
 * `inert` matters as much as the opacity: a preview that is still focusable puts
 * dead controls in the keyboard path of a screen that otherwise works.
 */
export function SoonOverlay({
  children,
  note,
  className,
}: {
  children: ReactNode;
  note: string;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <div className="pointer-events-none opacity-40 select-none" inert>
        {children}
      </div>
      {/*
        Anchored to the top edge, not centred. Centring puts the note wherever
        the dimmed block's midpoint happens to land, and that is a content line
        as often as not: on the Planner it sat exactly on the one line of example
        chat it was captioning, and on Stats — where the two chart cards stack at
        mobile width — it straddled the seam between them, captioning neither.
        The top edge is the one position in a laid-out region that is reliably a
        caption, and §3.8 wants the layout underneath left reviewable.
      */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center p-3">
        {/* Opaque, not translucent: a label you can read the page through looks
            like a rendering accident rather than a deliberate plug. */}
        <span className="max-w-full rounded-lg border border-dashed border-border bg-background px-3 py-1.5 text-center text-xs text-muted-foreground shadow-sm">
          {note}
        </span>
      </div>
    </div>
  );
}
