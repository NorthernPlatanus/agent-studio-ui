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
  className,
}: {
  children: ReactNode;
  rhythm?: "default" | "tight" | "steps";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "pt-1",
        rhythm === "tight" && "space-y-3",
        rhythm === "default" && "space-y-4",
        rhythm === "steps" && "space-y-5",
        className,
      )}
    >
      {children}
    </div>
  );
}
