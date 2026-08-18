/**
 * The box you type into — one raised surface, not a textarea with a button
 * parked next to it.
 *
 * Both places that compose share this: the start form, which opens a session,
 * and the reply composer, which answers a question inside one. They had drifted
 * into two different shapes for the same act — the start form a full-width
 * `CONTROL` textarea with the submit button four elements further down past a
 * disclosure and a checkbox, the reply a flex row of `textarea · Send · Back`.
 * Neither reads as a place to write; the first put ~1150px of empty field in
 * front of an operator whose answer is usually one sentence.
 *
 * The shape is the one every chat converged on for a reason: the field and the
 * things that act on it inside a single border, so the eye reads "here is where
 * you write and here is what happens next" as one object. It is built from the
 * shell's own control idiom (`CONTROL` — `rounded-lg border-border bg-card`)
 * rather than imported wholesale, so it sits in the same family as the filter
 * pills and the run launcher.
 *
 * Two things it deliberately does not do:
 *
 *   - It is not a `Panel`. A panel is a titled region that owns actions; this is
 *     a control group, and giving it a header would put a third heading on a
 *     screen that already has the location chip and the panel title.
 *   - It does not own its footer. What sits under the field differs per caller
 *     (attach + send, or send + back, or a row of recovery buttons), and the
 *     one thing they must share is the border around them.
 */

import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";
import { FOCUS_RING_WITHIN } from "@/shared/ui/focus";

export function ComposerShell({
  value,
  onChange,
  onSubmit,
  placeholder,
  disabled = false,
  rows = 3,
  label,
  actions,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  /** Enter (without shift) and the caller's submit control both land here. */
  onSubmit: () => void;
  placeholder: string;
  disabled?: boolean;
  rows?: number;
  /** Names the field itself. What it is *answering* is announced by the caller's
   *  focus group, not repeated here — see `useActionZoneFocus`. */
  label: string;
  /** The row under the field: attach, send, whatever the state offers. */
  actions: ReactNode;
  className?: string;
}) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      className={cn(
        // `focus-within` rather than `focus-visible` on the textarea: the ring
        // belongs to the whole object, or the field lights up inside a box that
        // stays inert and the two read as unrelated.
        "rounded-lg border border-border bg-card transition-[color,box-shadow]",
        FOCUS_RING_WITHIN,
        disabled && "opacity-50",
        className,
      )}
    >
      {/*
        Transparent and borderless: the border is the shell's, one level up.
        `field-sizing-content` grows the box with the answer up to a cap, so a
        three-line answer gets three lines instead of a scrollbar inside a fixed
        two-line well.

        The floor is a `min-height`, not `rows`: `field-sizing: content` takes
        the sizing over from the attribute entirely, and with `rows` alone the
        opening field rendered as a single 21px line — a slot, not a place to
        describe a feature. `rows` stays as the fallback for engines without
        `field-sizing`, where it is still what does the work.
      */}
      <textarea
        rows={rows}
        style={{ minHeight: `calc(${rows} * 1.35rem)` }}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          // Enter sends, shift+enter breaks the line. An answer here is usually
          // one sentence, and reaching for a button after every one is friction
          // in the loop's tightest cycle.
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            onSubmit();
          }
        }}
        placeholder={placeholder}
        aria-label={label}
        className={cn(
          "block max-h-64 w-full resize-none bg-transparent px-3.5 pt-3 pb-1.5",
          "text-[13px] leading-relaxed text-foreground outline-none",
          "field-sizing-content placeholder:text-muted-foreground",
        )}
      />
      <div className="flex flex-wrap justify-between items-center gap-1.5 px-2 pb-2">{actions}</div>
    </form>
  );
}
