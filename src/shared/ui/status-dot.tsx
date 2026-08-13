/**
 * The status vocabulary, in one place: five tones, one dot, one chip.
 *
 * `progress` pulses — it is the only animation in the shell, and it means
 * exactly one thing: something is running right now.
 */

import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";

export type Tone = "neutral" | "progress" | "good" | "warn" | "bad";

const DOT: Record<Tone, string> = {
  neutral: "bg-status-neutral",
  progress: "bg-status-progress",
  good: "bg-status-good",
  warn: "bg-status-warn",
  bad: "bg-status-bad",
};

export function StatusDot({
  tone,
  pulse = tone === "progress",
  className,
}: {
  tone: Tone;
  pulse?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("relative inline-flex size-2 shrink-0", className)} aria-hidden="true">
      {pulse ? (
        <span
          className={cn(
            "absolute inline-flex size-full animate-ping rounded-full opacity-60",
            DOT[tone],
          )}
        />
      ) : null}
      <span className={cn("relative inline-flex size-full rounded-full", DOT[tone])} />
    </span>
  );
}

const CHIP: Record<Tone, string> = {
  neutral: "border-border text-muted-foreground",
  progress: "border-status-progress/35 bg-status-progress/10 text-status-progress",
  good: "border-status-good/35 bg-status-good/10 text-status-good",
  warn: "border-status-warn/40 bg-status-warn/10 text-status-warn",
  bad: "border-status-bad/40 bg-status-bad/10 text-status-bad",
};

/**
 * The reference's feature-chip row, doing real work (`DESIGN.md` §3.6): object
 * attributes read in one saccade — `domain:frontend`, `risk:high`, `visual`.
 */
export function Chip({
  children,
  tone = "neutral",
  title,
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  title?: string | undefined;
  className?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded border px-1.5 py-px text-[11px] font-medium leading-5",
        CHIP[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** A chip with a leading dot — the standard rendering for a lifecycle status. */
export function StatusChip({
  tone,
  children,
  title,
}: {
  tone: Tone;
  children: ReactNode;
  title?: string | undefined;
}) {
  return (
    <Chip tone={tone} title={title}>
      <StatusDot tone={tone} className="size-1.5" />
      {children}
    </Chip>
  );
}
