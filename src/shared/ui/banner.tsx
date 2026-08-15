/**
 * Tier 2 (`DEVDOCS/DESIGN.md` §3.4): tinted, single-purpose feedback that lives
 * **inside** the panel whose inputs produced it — the reference's blue price
 * strip under the configuration grid.
 *
 * This is where a computed estimate, a precondition failure, or a "this spends
 * quota" warning goes. Not a toast (it is not transient) and not its own panel
 * (it is not a region).
 */

import { AlertTriangleIcon, CheckCircle2Icon, InfoIcon, OctagonAlertIcon } from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { cn } from "@/shared/lib/utils";

export type BannerTone = "info" | "good" | "warn" | "bad";

/**
 * Tone is carried by the border and the icon, and **not** by a fill.
 *
 * The tint was `bg-<status>/10` on every tone. It sat directly under body text
 * whose own colour is `foreground/90`, so the contrast the palette is tuned for
 * — status ink on `--card` — was not the contrast being rendered, and a warm
 * wash under grey text is what made these read as smudged rather than as
 * containing anything. On the surfaces these actually appear on (a spec card
 * inside a panel inside a sheet) it was also the fourth stacked value in a row,
 * which is what `DESIGN.md` §3.3 spends its length ruling out.
 *
 * A border and a coloured glyph are enough to say which of four kinds this is.
 */
const TONE: Record<BannerTone, { box: string; icon: ComponentType<{ className?: string }> }> = {
  info: {
    box: "border-status-progress/30 text-status-progress",
    icon: InfoIcon,
  },
  good: {
    box: "border-status-good/30 text-status-good",
    icon: CheckCircle2Icon,
  },
  warn: {
    box: "border-status-warn/35 text-status-warn",
    icon: AlertTriangleIcon,
  },
  bad: {
    box: "border-status-bad/35 text-status-bad",
    icon: OctagonAlertIcon,
  },
};

export function Banner({
  tone = "info",
  children,
  actions,
  className,
}: {
  tone?: BannerTone;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  const { box, icon: Icon } = TONE[tone];
  return (
    <div
      className={cn("flex items-start gap-2.5 rounded-md border px-3.5 py-2.5", box, className)}
      role={tone === "bad" ? "alert" : undefined}
    >
      <Icon className="mt-px size-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1 text-[13px] leading-relaxed text-foreground/90">
        {children}
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  );
}
