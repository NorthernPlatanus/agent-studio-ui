/**
 * What the operator types next — and, when a proposal is on the table, what they
 * press instead.
 *
 * The loop reads exactly one string per turn, but it means two different things
 * depending on where it is blocked, and conflating them is how an operator loses
 * a plan: at the preview the loop tests the reply against `y` / `abort` and
 * treats *anything else* as an edit note. Someone typing "looks good" there
 * would not approve the plan — they would send the planner back for another
 * ~400k-token round with "looks good" as the steer. So the decision state gets
 * buttons, and the free-text box only appears once the operator has chosen to
 * revise.
 *
 * The decision bar itself lives in `DiscussDecision`, and the page renders it in
 * the action zone — the pinned strip this composer also occupies — rather than
 * here or in the specs panel. It is still *after* the specs in reading order,
 * which is what a screen reader reaching "Apply to the backlog" before the list
 * it applies to needs; it is simply after them at the foot of the frame instead
 * of inside their border. (It did sit in that border once. The panel scrolls, so
 * past two or three specs the irreversible button left the screen — see
 * `pages/planner/planner-page.tsx` for the full account.) `revising` is lifted to
 * the page, since it is the one piece of state the two halves share.
 */

import { ArrowUpIcon, CheckIcon, CircleSlashIcon, PencilIcon, RotateCwIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Expects } from "@/entities/discuss";
import { Button } from "@/shared/ui/button";
import { ComposerShell } from "./composer-shell";

/**
 * Moves focus into the action zone when the loop starts waiting on the operator.
 *
 * Every turn used to end with focus on `document.body`. Pressing Enter disables
 * the textarea (`reply.isPending`), and disabling the focused element silently
 * drops focus; the box then unmounts for the length of the turn and remounts
 * empty and unfocused. A keyboard-only operator had to tab past the skip link,
 * the nav toggle, the breadcrumb and fifteen nav rows to answer each question.
 *
 * The group — not the textarea — is what takes focus, and that distinction is
 * the whole reason the old code refused to autofocus at all. Focusing a raw
 * textarea makes a screen reader say "edit, blank, Answer the planner's
 * question…" and skip the question itself. Focusing a labelled group announces
 * the question first, then the control. The original comment was right about the
 * harm and wrong only in concluding that silence was the safer option: with no
 * live region on the log, nothing was reading the question to interrupt.
 */
function useActionZoneFocus(expects: Expects, revising: boolean) {
  const group = useRef<HTMLFieldSetElement>(null);
  const previous = useRef<{ expects: Expects; revising: boolean }>({ expects, revising });

  useEffect(() => {
    const was = previous.current;
    previous.current = { expects, revising };
    // Only on a transition *into* something actionable — never on mount, never
    // on an unrelated re-render, and never while the operator is mid-sentence.
    const becameActionable = was.expects === null && expects !== null;
    const swappedMode = was.expects === expects && was.revising !== revising;
    if (becameActionable || swappedMode) group.current?.focus();
  }, [expects, revising]);

  return group;
}

export function DiscussComposer({
  expects,
  disabled,
  revising,
  onRevisingChange,
  onSend,
  labelledBy,
}: {
  expects: Expects;
  disabled: boolean;
  /** Lifted: `DiscussDecision`'s Revise button is what sets it, and the specs
   *  panel reads it to decide what its note says. Three places, one owner. */
  revising: boolean;
  onRevisingChange: (revising: boolean) => void;
  onSend: (text: string) => void;
  /** Id of the pending question's text, so the zone announces it on focus. */
  labelledBy?: string | undefined;
}) {
  const [text, setText] = useState("");
  const group = useActionZoneFocus(expects, revising);

  const send = (value: string) => {
    onSend(value);
    setText("");
    onRevisingChange(false);
  };

  // The wrapper every branch shares. A `<fieldset>` rather than a `role="group"`
  // div — it is literally a group of form controls, and the native element gets
  // the semantics for free. `tabIndex={-1}` makes it programmatically focusable
  // without adding a tab stop; `outline-none` because the focus here is a handoff
  // to the control inside, not a thing to draw a ring around.
  const zone = (children: React.ReactNode) => (
    <fieldset
      ref={group}
      tabIndex={-1}
      aria-labelledby={labelledBy}
      aria-label={labelledBy ? undefined : "Planner reply"}
      className="min-w-0 border-0 p-0 outline-none"
    >
      {children}
    </fieldset>
  );

  // A turn is in flight. The composer stays *mounted and inert* rather than
  // being swapped for a line of text, for two reasons.
  //
  // It was a duplicate: the transcript's live row, forty pixels above, already
  // says the planner is working, with the pulsing dots and the elapsed
  // expectation attached to it. Saying it again in a bare strip where the field
  // used to be is the second copy, and the weaker one.
  //
  // And the field is the thing the operator is waiting to use. Removing it for
  // the five to ten minutes a turn takes means the box they were typing in
  // vanishes and a differently-shaped one materialises when the question lands.
  // Held in place and dimmed, the shape never moves; only its state changes.
  if (expects === null) {
    return zone(
      <ComposerShell
        value=""
        onChange={() => {}}
        onSubmit={() => {}}
        placeholder="The next question arrives here."
        disabled
        rows={2}
        label="Your reply to the planner"
        actions={
          <Button type="submit" size="icon-sm" className="ml-auto" aria-label="Send" disabled>
            <ArrowUpIcon aria-hidden="true" />
          </Button>
        }
      />,
    );
  }

  // Frozen on an exhausted usage window. There is no question to answer and
  // nothing to retry by hand — the loop resumes itself when the window resets.
  // The only decision left is whether to keep waiting, so that is the only
  // control offered; the transcript row above carries the reset time.
  if (expects === "frozen") {
    return zone(
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" onClick={() => send("abort")} disabled={disabled}>
          <CircleSlashIcon aria-hidden="true" />
          Stop waiting
        </Button>
        {/* The reset time and the "it resumes itself" promise are on the
            `limit_paused` row in the transcript. Repeating them here is the
            second copy of a sentence the operator has already read. */}
        <span className="text-[12px] text-muted-foreground">Stopping discards the session.</span>
      </div>,
    );
  }

  // A failed turn. The retry is a BUTTON, not an empty text submit: the form
  // below refuses to send an empty string, so with only that path an operator
  // whose turn failed could not retry at all without inventing something to
  // type. Typing is still offered — anything entered becomes extra context for
  // the next attempt rather than an answer to a question that was never asked.
  if (expects === "retry" && !revising) {
    return zone(
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => send("")} disabled={disabled}>
          <RotateCwIcon aria-hidden="true" />
          Try that turn again
        </Button>
        <Button variant="outline" onClick={() => onRevisingChange(true)} disabled={disabled}>
          <PencilIcon aria-hidden="true" />
          Retry with more context
        </Button>
        <Button variant="ghost" onClick={() => send("abort")} disabled={disabled}>
          <CircleSlashIcon aria-hidden="true" />
          Discard
        </Button>
      </div>,
    );
  }

  // The page swaps this whole component out for `DiscussDecision` while a
  // proposal is undecided — there is nothing to compose until the operator
  // chooses to revise, and a text box beside the approve button is exactly the
  // free-text trap described at the top of this file.
  if (expects === "decision" && !revising) return null;

  const placeholder =
    expects === "decision"
      ? "What should change about the plan?"
      : expects === "retry"
        ? "Anything to add before retrying? (optional)"
        : "Answer the planner's question…";

  return zone(
    // Still no `autoFocus` on the textarea itself — see `useActionZoneFocus`.
    // The fieldset above takes focus and announces the question; the operator's
    // first keystroke lands in the field because it is the first control in the
    // group, and a screen reader has heard what it is answering. The shell's own
    // `aria-label` names the field, it does not repeat the question.
    <ComposerShell
      value={text}
      onChange={setText}
      onSubmit={() => {
        if (text.trim() !== "") send(text.trim());
      }}
      placeholder={placeholder}
      disabled={disabled}
      rows={2}
      label="Your reply to the planner"
      actions={
        <>
          {expects === "decision" || expects === "retry" ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => onRevisingChange(false)}
              disabled={disabled}
            >
              Back
            </Button>
          ) : null}
          <Button
            type="submit"
            size="icon-sm"
            className="ml-auto"
            aria-label="Send"
            disabled={disabled || text.trim() === ""}
          >
            <ArrowUpIcon aria-hidden="true" />
          </Button>
        </>
      }
    />,
  );
}

/**
 * The commitment step, rendered by the page in the pinned action zone.
 *
 * Split out of the composer because it is not a composer: it is three fixed
 * choices, and the reply box must not be on screen beside them (see the top of
 * this file for what "looks good" typed at a preview does).
 *
 * Where it sits is the page's call, not this component's, and it has moved once:
 * out of the specs panel's footer and into the action zone. The panel version
 * had the better adjacency — inside the border of the thing it writes — and lost
 * on reachability, because that panel scrolls and a thirty-spec proposal pushed
 * its own approve button off the bottom of a pane it could not be scrolled back
 * into. The consequence banner travelled with it, so the warning is still
 * directly above these buttons.
 */
export function DiscussDecision({
  disabled,
  onApply,
  onRevise,
  onDiscard,
}: {
  disabled: boolean;
  onApply: () => void;
  onRevise: () => void;
  onDiscard: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button onClick={onApply} disabled={disabled}>
        <CheckIcon aria-hidden="true" />
        Apply to the backlog
      </Button>
      <Button variant="outline" onClick={onRevise} disabled={disabled}>
        <PencilIcon aria-hidden="true" />
        Revise
      </Button>
      {/* No caption. The consequence of applying is stated once, in the tinted
          banner directly above this row — saying it twice in two type sizes is
          how a warning stops being read. */}
      <Button variant="ghost" onClick={onDiscard} disabled={disabled}>
        <CircleSlashIcon aria-hidden="true" />
        Discard
      </Button>
    </div>
  );
}
