/**
 * Form controls, in the shell's own idiom: 32px tall, `rounded-lg`, raised on
 * `bg-card` — the same floating-pill shape as the chrome (`DESIGN.md` §3.3),
 * not shadcn's taller default input.
 *
 * These exist because the same class string had been pasted into the task
 * filter bar, the run launcher and the plan panel, which is how three controls
 * that should look identical start to drift apart.
 *
 * A control carrying a value gets a stronger border, so "this filter is on" is
 * legible without reading the value — the filter bar's whole job at a glance.
 */

import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/shared/lib/utils";
import { FOCUS_RING } from "@/shared/ui/focus";

export const CONTROL = cn(
  "h-8 rounded-lg border border-border bg-card px-2.5 text-[13px] text-foreground",
  "transition-[color,box-shadow] placeholder:text-muted-foreground disabled:opacity-50",
  FOCUS_RING,
);

export const CONTROL_ACTIVE = "border-foreground/25 font-medium";

export function TextInput({
  active = false,
  className,
  ...props
}: ComponentProps<"input"> & { active?: boolean }) {
  return <input className={cn(CONTROL, active && CONTROL_ACTIVE, className)} {...props} />;
}

/**
 * A native `<select>` deliberately: the filter bar has seven of them, they hold
 * short lists, and the platform picker is faster to use — and far less code —
 * than a listbox rebuilt in React.
 */
export function SelectInput({
  active = false,
  className,
  children,
  ...props
}: ComponentProps<"select"> & { active?: boolean; children: ReactNode }) {
  return (
    <select className={cn(CONTROL, active && CONTROL_ACTIVE, className)} {...props}>
      {children}
    </select>
  );
}

/** The label above a control: small, quiet, uppercase — matches `SectionHeading`. */
export function ControlLabel({ htmlFor, children }: { htmlFor: string; children: ReactNode }) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
    >
      {children}
    </label>
  );
}
