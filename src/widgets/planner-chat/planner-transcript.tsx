/**
 * The conversation, as a **log** rather than a chat app.
 *
 * Deliberately not speech bubbles. This is a control panel, and the operator is
 * reading a machine-generated planning trace where the interesting rows are the
 * questions and the assumptions, not the pleasantries — a Tier-3 region with a
 * labelled gutter (`YOU` / `PLANNER`) matches the event log two screens over and
 * lets the eye skip to the row types that matter. `DESIGN.md`'s rejection of the
 * generic shell applies double here: a messenger UI is exactly what this would
 * have become by default.
 *
 * The frames are also not a two-party dialogue. Half of them — `assumption`,
 * `note`, `limit_paused`, `turn_failed`, `applied`, `aborted` — are loop events
 * with no speaker, and an alternating left/right axis would have to invent one
 * for each of them while destroying the scan column that makes a lone
 * `assumption` findable in forty rows.
 *
 * Exactly one thing is taken from the messenger references, because it solves a
 * real problem the log had: **the operator's own turns sit on a surface**
 * (`Line surface`). Scrolling back through a long session to find what you last
 * told the planner, a `you` row differed from a `question` row by one gutter
 * word and a font weight — nothing the eye catches in motion. A tint is caught.
 * It is still a full-width row with the same gutter and the same timestamp; the
 * bubble is what was left behind.
 *
 * Frame kinds each get a shape, because they are genuinely different things:
 *
 *   you           what the operator sent
 *   thinking      the planner call is in flight (a live row, replaced on arrival)
 *   progress      what that in-flight call is doing right now. NOT a log row: it
 *                 folds into the live thinking line, because a turn emits
 *                 hundreds of these and "read src/foo.ts" is worth nothing once
 *                 the turn is over. The server retains only the latest for the
 *                 same reason.
 *   assumption    something the planner decided rather than asked — the row most
 *                 worth catching, since an unchallenged assumption becomes a spec
 *   question      the thing the loop is blocked on
 *   note          a loop-level remark (the max-rounds cap firing)
 *   turn_failed   the planner call itself failed. Recoverable, and pointedly NOT
 *                 the same as `error`: the conversation is still open and the
 *                 composer is offering another attempt.
 *   limit_paused  the subscription window ran out mid-session and the loop is
 *                 waiting for it to reset. It resumes on its own — the row says
 *                 when, so the operator can leave.
 *   specs_preview rendered by the artifacts panel, summarised here as a marker
 *   applied/aborted/error/closed  terminal
 */

import {
  AlertTriangleIcon,
  CheckIcon,
  CircleSlashIcon,
  LightbulbIcon,
  PauseIcon,
} from "lucide-react";
import { useEffect, useRef } from "react";
import type { DiscussFrame, DiscussSession } from "@/entities/discuss";
import { formatClock } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";
import { Chip } from "@/shared/ui/status-dot";

/** Frames the artifacts panel owns; the transcript only marks that they happened.
 *  `progress` is here for a different reason — it belongs to the live row. */
const RENDERED_ELSEWHERE = new Set(["specs_preview", "awaiting", "closed", "progress"]);

/** The DOM id of a question's text, so the action zone can be labelled by it. */
export function questionLabelId(seq: number): string {
  return `planner-question-${seq}`;
}

function Gutter({ label, tone }: { label: string; tone?: "you" | "planner" | undefined }) {
  return (
    <span
      className={cn(
        "w-16 shrink-0 pt-px text-[10px] font-medium uppercase tracking-wider",
        tone === "you" ? "text-foreground/70" : "text-muted-foreground",
      )}
    >
      {label}
    </span>
  );
}

function Line({
  label,
  tone,
  ts,
  surface = false,
  children,
}: {
  label: string;
  tone?: "you" | "planner" | undefined;
  ts?: number;
  /** Puts the content on a raised tint. The one thing worth taking from a
   *  messenger UI: the operator's own turns need to be findable when scrolling
   *  back through a hundred machine frames, and a surface does that in
   *  peripheral vision where a gutter word does not. Not a bubble — full width,
   *  same row, same gutter, same timestamp. */
  surface?: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3 px-1 py-2 text-[13px]">
      <Gutter label={label} tone={tone} />
      {/*
        `max-w-[68ch]`: these rows are as wide as the panel, which on a 1440px
        window with both rails shut is past 110 characters — roughly twice the
        measure prose stays readable at, and the reason a three-line question
        read as a wall. The column keeps its left edge so the gutter still lines
        up; the slack goes to the right of the text, where the timestamp is.
      */}
      <div
        className={cn(
          "min-w-0 max-w-[68ch] flex-1 whitespace-pre-wrap break-words",
          surface && "rounded-md bg-foreground/[0.055] px-3 py-1.5",
        )}
      >
        {children}
      </div>
      {ts === undefined ? null : (
        <span className="shrink-0 pt-1 font-mono text-[11px] tabular-nums text-muted-foreground">
          {formatClock(ts)}
        </span>
      )}
    </li>
  );
}

function FrameRow({ frame }: { frame: DiscussFrame }) {
  const data = frame.data;

  switch (frame.kind) {
    case "you":
      return (
        <Line label="You" tone="you" ts={frame.ts} surface>
          {String(data.text ?? "")}
        </Line>
      );

    case "assumption":
      return (
        <Line label="Planner" ts={frame.ts}>
          <span className="flex items-start gap-2">
            <LightbulbIcon
              className="mt-0.5 size-3.5 shrink-0 text-status-warn"
              aria-hidden="true"
            />
            <span>
              <Chip tone="warn">assumption</Chip>{" "}
              <span className="text-muted-foreground">{String(data.text ?? "")}</span>
            </span>
          </span>
        </Line>
      );

    case "question":
      return (
        <Line label="Planner" ts={frame.ts}>
          <span className="flex flex-wrap items-baseline gap-x-2">
            {data.id ? <Chip>{String(data.id)}</Chip> : null}
            {/* The id is what the composer points `aria-labelledby` at, so the
                action zone announces the question rather than "edit, blank". */}
            <span id={questionLabelId(frame.seq)} className="font-medium">
              {String(data.q ?? "")}
            </span>
          </span>
          {data.why ? (
            <span className="mt-0.5 block text-[12px] text-muted-foreground">
              why it matters: {String(data.why)}
            </span>
          ) : null}
        </Line>
      );

    case "note":
      return (
        <Line label="Loop" ts={frame.ts}>
          <span className="text-muted-foreground">{String(data.text ?? "")}</span>
        </Line>
      );

    case "applied":
      return (
        <Line label="Loop" ts={frame.ts}>
          <span className="flex items-center gap-2 text-status-good">
            <CheckIcon className="size-3.5" aria-hidden="true" />
            Applied {String(data.count ?? 0)} spec(s) to the backlog.
          </span>
        </Line>
      );

    case "aborted":
      return (
        <Line label="Loop" ts={frame.ts}>
          <span className="flex items-center gap-2 text-muted-foreground">
            <CircleSlashIcon className="size-3.5" aria-hidden="true" />
            Closed — nothing was written.
            {data.reason ? <span>({String(data.reason)})</span> : null}
          </span>
        </Line>
      );

    case "limit_paused": {
      const resetsAt = typeof data.resets_at === "number" ? data.resets_at : null;
      return (
        <Line label="Loop" ts={frame.ts}>
          <span className="flex items-start gap-2 text-status-warn">
            <PauseIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span>
              <span className="font-medium">
                Subscription limit reached — waiting for the{" "}
                {String(data.limit_type ?? "usage").replace(/_/g, "-")} window.
              </span>
              <span className="mt-0.5 block text-[12px] text-muted-foreground">
                {resetsAt
                  ? `Resumes on its own at ${formatClock(resetsAt)}. Nothing is lost — the turn is retried then.`
                  : "Resumes on its own once the window resets."}
              </span>
            </span>
          </span>
        </Line>
      );
    }

    case "turn_failed":
      return (
        <Line label="Loop" ts={frame.ts}>
          <span className="flex items-start gap-2 text-status-warn">
            <AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span>
              <span className="font-medium">That planner turn failed.</span>{" "}
              <span className="text-muted-foreground">{String(data.text ?? "")}</span>
              <span className="mt-0.5 block text-[12px] text-muted-foreground">
                The conversation is intact — retrying resends this turn.
              </span>
            </span>
          </span>
        </Line>
      );

    case "error":
      return (
        <Line label="Loop" ts={frame.ts}>
          <span className="flex items-start gap-2 text-status-bad">
            <AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            {String(data.text ?? "The session failed.")}
          </span>
        </Line>
      );

    default:
      return null;
  }
}

/** What the in-flight call is doing, from the newest `progress` frame.
 *  Exported because the spoken heartbeat folds the same string in at its own,
 *  much slower cadence (`turn-heartbeat.tsx`). */
export function activity(frame: DiscussFrame | undefined): string | null {
  if (!frame) return null;
  const { phase, tool, target, text } = frame.data as Record<string, unknown>;
  if (phase === "tool") {
    return target ? `${String(tool)} ${String(target)}` : String(tool ?? "working");
  }
  if (phase === "text" && text) return String(text);
  if (phase === "thinking") return "thinking…";
  return null;
}

/** The "planner is working" row — a live line, not a spinner in the corner.
 *
 * The static sentence stays as the floor. A planner turn was measured at 334s
 * one run and 539s the next, and for most of that the only honest thing to say
 * is "still going" — but when the CLI tells us what it is reading, saying so is
 * the difference between a progress bar and a hang.
 *
 * Rendered **outside** the `role="log"` list, and that placement is an
 * accessibility requirement rather than a layout preference. A live region
 * announces subtree *text changes*, not just insertions, and this row's activity
 * line re-renders on every `progress` frame — hundreds per turn. Inside the log
 * it would keep the polite queue permanently full, and the question the operator
 * is actually waiting for would land nine minutes behind a recital of every file
 * the planner opened. The activity text is `aria-hidden` for the same reason;
 * the throttled `role="status"` heartbeat carries this state to a screen reader
 * instead, at roughly one line per 45 seconds.
 */
function Thinking({ progress }: { progress?: DiscussFrame | undefined }) {
  const data = (progress?.data ?? {}) as Record<string, unknown>;
  // The two channels are rendered differently because they are different kinds
  // of text. A tool call is machine output — monospaced, clipped to one line,
  // worthless once the turn is over. `phase === "text"` is the planner's own
  // prose, and folding it into that same truncated mono line (which is what
  // `activity()` does, correctly, for the *spoken* channel) threw away the one
  // thing there is to watch during a nine-minute turn.
  const prose = data.phase === "text" && data.text ? String(data.text) : null;
  const tool =
    data.phase === "tool"
      ? data.target
        ? `${String(data.tool)} ${String(data.target)}`
        : String(data.tool ?? "working")
      : null;

  return (
    <div className="flex gap-3 px-1 py-2 text-[13px]">
      <Gutter label="Planner" />
      {/* `min-w-0`: without it this flex item sizes to its content, the `truncate`
          below never engages, and a long tool target pushed the row 115px past
          the work column's right edge at 375px. */}
      <div className="flex min-w-0 max-w-[68ch] flex-1 items-start gap-2">
        <span className="flex shrink-0 gap-1 pt-2 text-muted-foreground" aria-hidden="true">
          <span className="size-1 animate-pulse rounded-full bg-current [animation-delay:0ms]" />
          <span className="size-1 animate-pulse rounded-full bg-current [animation-delay:150ms]" />
          <span className="size-1 animate-pulse rounded-full bg-current [animation-delay:300ms]" />
        </span>
        <div className="min-w-0 flex-1">
          {prose ? (
            <span
              aria-hidden="true"
              className="block whitespace-pre-wrap break-words text-foreground"
            >
              {prose}
              <span className="ml-px inline-block animate-pulse text-muted-foreground">▍</span>
            </span>
          ) : (
            <>
              {tool ? (
                <span
                  aria-hidden="true"
                  className="block truncate font-mono text-[12px] text-foreground"
                >
                  {tool}
                </span>
              ) : null}
              <span className="text-muted-foreground">
                reading the repo and the backlog — turns run five to ten minutes
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** Within this many pixels of the bottom still counts as "reading the tail". */
const TAIL_SLACK_PX = 56;

/**
 * Whether the log is scrolled to (or near) its end.
 *
 * Exported so the rule can be tested without a layout engine: jsdom reports zero
 * for every scroll metric, which makes every element look pinned to its tail.
 */
export function atTail(box: {
  scrollHeight: number;
  scrollTop: number;
  clientHeight: number;
}): boolean {
  return box.scrollHeight - box.scrollTop - box.clientHeight <= TAIL_SLACK_PX;
}

export function PlannerTranscript({
  session,
  className,
}: {
  session: DiscussSession;
  className?: string;
}) {
  const box = useRef<HTMLElement>(null);
  // Whether the operator is at the tail. A ref, not state: it changes on every
  // scroll event and nothing renders from it.
  const following = useRef(true);
  const count = session.frames.length;

  // Follow the tail on every new frame — but ONLY if that is where the operator
  // already was. A planner turn emits progress frames continuously, and scrolling
  // back to re-read a question the loop asked four turns ago used to be
  // impossible: the next frame yanked the view back to the bottom, mid-sentence.
  // Scrolling up is an explicit "I am reading something else", and it holds until
  // the operator scrolls back down.
  //
  // Setting `scrollTop` directly rather than `scrollIntoView` on a tail sentinel:
  // `scrollIntoView` walks up and scrolls *every* ancestor scroll container, so
  // each arriving frame could also move whatever the operator was reading
  // elsewhere on the page. This cannot escape the box — and it drops the jsdom
  // feature-detection the old call needed, since assigning a number always works.
  useEffect(() => {
    void count;
    if (following.current && box.current) box.current.scrollTop = box.current.scrollHeight;
  }, [count]);

  return (
    // A named `<section>` is implicitly `role="region"`, and the `tabIndex` is
    // there because this is a scroll container with zero focusable descendants —
    // every frame is text. Firefox focuses such elements on its own, Safari never
    // does, so without it a keyboard-only operator could not scroll back to
    // re-read anything: the auto-follow pins them to the tail with no way out.
    // The visible focus style is then mandatory (2.4.7).
    <section
      ref={box}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region with no focusable descendants must itself be focusable or it cannot be scrolled by keyboard at all (WCAG 2.1.1). The rule's "confuses users" rationale assumes the content is reachable some other way; here it is not.
      tabIndex={0}
      aria-label="Planner conversation"
      onScroll={() => {
        if (box.current) following.current = atTail(box.current);
      }}
      // No border and no fill. This sits inside a `Panel`, which already draws
      // the frame — a second bordered well inside it made the conversation a box
      // in a box, and because the region is `h-full` under a fill panel, a short
      // conversation drew that box around several hundred pixels of nothing.
      // `DESIGN.md` §3.4: a log is Tier 3, content directly on its surface.
      className={cn(
        "min-h-0 overflow-y-auto px-2 py-1",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        className,
      )}
    >
      {/*
        `min-h-full` + `justify-end` bottom-aligns a conversation too short to
        fill the panel, so the newest frame sits just above the composer instead
        of at the top of several hundred pixels of empty panel. The wrapper
        carries it rather than the scroll container: `justify-content: flex-end`
        on an element that also scrolls puts the overflowing top out of reach in
        every engine, and this conversation is read by scrolling back.
      */}
      <div className="flex min-h-full flex-col justify-end">
        {/*
          `role="log"` carries an implicit `aria-live="polite"`, which is what
          finally makes an arriving question audible. It works only because the
          continuously-mutating `Thinking` row is a sibling rather than a child —
          see its doc comment.
        */}
        <ul role="log" aria-busy={session.status === "running"} className="divide-y divide-border">
          {session.frames
            .filter((frame) => !RENDERED_ELSEWHERE.has(frame.kind))
            .map((frame) => (
              <FrameRow key={frame.seq} frame={frame} />
            ))}
        </ul>
        {session.status === "running" ? (
          <Thinking progress={session.frames.findLast((f) => f.kind === "progress")} />
        ) : null}
      </div>
    </section>
  );
}
