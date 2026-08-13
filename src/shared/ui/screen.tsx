/**
 * The root of a screen.
 *
 * Exists to own one thing every page had been deciding for itself: the gap under
 * the chrome and the rhythm between regions. Those had drifted to `pt-1` on
 * loaded states and `pt-2` on loading ones, so content jumped four pixels the
 * moment data arrived — small, but visible on every navigation, and the sort of
 * thing that reads as jank without anyone being able to say why.
 *
 * `rhythm="steps"` is the wider spacing for a sequenced flow (the launch
 * screen), where the gaps between steps carry meaning.
 */

import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";

export function Screen({
  children,
  rhythm = "default",
  fill = false,
  className,
}: {
  children: ReactNode;
  rhythm?: "default" | "tight" | "steps";
  /**
   * The screen owns the viewport: it does not scroll, and exactly one region
   * inside it does.
   *
   * Requires `height: "fill"` on the route (`nav-config.ts`), which is what
   * stops `<main>` scrolling — the two are a pair and neither works alone. This
   * exists because the planner is the app's first screen that is a *frame*
   * rather than a document, and without it the only way to bound a chat log was
   * `max-h-[58vh]`: a viewport unit in a container-query codebase, measuring
   * against something that is not the work column. That produced two scrollbars,
   * a composer that drifted below the fold as the artifact grew, and a page
   * whose geometry changed for the first few frames and then stopped.
   */
  fill?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        fill
          ? "flex h-full min-h-0 flex-col gap-3 pt-1 pb-1"
          : [
              "pt-1",
              rhythm === "tight" && "space-y-3",
              rhythm === "default" && "space-y-4",
              rhythm === "steps" && "space-y-5",
            ],
        className,
      )}
    >
      {children}
    </div>
  );
}
