/**
 * A Tier-3 region (`DEVDOCS/DESIGN.md` §3.4) that starts folded.
 *
 * Exists because a screen can have exactly one subject, and everything else on
 * it has to be visibly subordinate or the subject stops reading as the subject.
 * The planner page is the case that forced it: session settings and attachments
 * were a two-column grid of full panels under the chat, which gave the knobs the
 * same weight as the conversation they configure.
 *
 * Folded, not removed — these are real controls an operator reaches for
 * mid-session, so the summary carries a count (`3 attached`) and the affordance
 * stays one click away.
 *
 * Native `<details>`, deliberately: it is keyboard- and screen-reader-correct
 * with no state to hold, it survives a re-render without a store, and browser
 * find-in-page opens it. The summary is styled to match `SectionHeading`, so a
 * folded region and an open one read as the same tier.
 */

import { ChevronRightIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";

export function Disclosure({
  title,
  meta,
  defaultOpen = false,
  children,
  className,
}: {
  title: ReactNode;
  /** A count or a one-line reason to open it. Visible while folded. */
  meta?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <details open={defaultOpen} className={cn("group", className)}>
      {/*
        `list-none` plus the explicit chevron, rather than the platform marker:
        the default triangle is a different glyph and a different size in every
        engine, and this one lines up with the nav rail's own disclosure arrows.
      */}
      <summary className="flex min-h-7 cursor-pointer list-none items-center gap-2 rounded-md text-[11px] font-medium uppercase tracking-wider text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        <ChevronRightIcon
          className="size-3.5 shrink-0 transition-transform duration-150 group-open:rotate-90"
          aria-hidden="true"
        />
        <span>{title}</span>
        {meta ? (
          <span className="normal-case tracking-normal text-muted-foreground/70">{meta}</span>
        ) : null}
      </summary>
      <div className="pt-2.5">{children}</div>
    </details>
  );
}
