/**
 * A labelled figure. Not a card — four `Metric`s in a row is a *row of figures*,
 * not four boxes, which is the difference between a control panel and the
 * four-equal-tiles layout every generated dashboard opens with.
 *
 * `hint` is the second-order figure that qualifies the first (the channel a cost
 * came from, what a rate is out of). It is never a sentence.
 */

import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";

export function Metric({
  label,
  value,
  hint,
  tone,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "muted";
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      {/* Values wrap rather than truncate: a clipped figure is worse than a
          wrapped one, and timestamps are routinely wider than their column. */}
      <div
        className={cn(
          "mt-1 text-lg font-semibold leading-tight tracking-tight break-words",
          tone === "muted" && "text-muted-foreground",
        )}
      >
        {value}
      </div>
      {hint ? <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  );
}

/**
 * Metrics on one baseline, separated by rules rather than by boxes.
 *
 * The separators are **borders on the children**, not gaps showing a coloured
 * container through. That distinction is the whole implementation: with
 * `gap-px` + `bg-border`, a row that wraps (four metrics into three columns)
 * paints its leftover cells as solid slabs of border colour. Children that draw
 * their own left/top rules leave an empty cell genuinely empty; the negative
 * margins tuck the outermost rules under the container's own border, and
 * `auto-fit` keeps the column count responsive without a per-page override.
 */
export function MetricRow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-xl border border-border bg-card", className)}>
      <div className="-ml-px -mt-px grid grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] [&>*]:border-l [&>*]:border-t [&>*]:border-border [&>*]:px-5 [&>*]:py-4">
        {children}
      </div>
    </div>
  );
}

/** A `label: value` line for dense key/value stacks inside a panel. */
export function Field({
  label,
  children,
  className,
}: {
  label: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-baseline gap-3 py-1.5 text-[13px]", className)}>
      <dt className="w-32 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 flex-1">{children}</dd>
    </div>
  );
}
