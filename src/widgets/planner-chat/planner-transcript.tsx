/**
 * The conversation, as a **log** rather than a chat app.
 *
 * This is a control panel, and the operator is reading a machine-generated
 * planning trace where the interesting rows are the questions and the
 * assumptions, not the pleasantries — a Tier-3 region with a labelled gutter
 * (`YOU` / `PLANNER`) matches the event log two screens over and lets the eye
 * skip to the row types that matter. `DESIGN.md`'s rejection of the generic
 * shell applies double here: a messenger UI is what this would have become by
 * default, and most of what that would have brought — bubbles with tails,
 * avatars, read state, a name on every row — is still absent on purpose. What it
 * borrows is the two things that carry information about *who is speaking*:
 * a tint, and a side.
 *
 * The frames are also not a two-party dialogue. Half of them — `assumption`,
 * `note`, `limit_paused`, `turn_failed`, `applied`, `aborted` — are loop events
 * with no speaker, and an *alternating* axis would have to invent one for each
 * of them.
 *
 * **What the operator's own turns get instead is the right edge** (`Line mine`).
 * Not an alternating layout: there are two positions here, not two speakers —
 * everything the machine produced stays in one column on the left, whatever kind
 * of frame it is, and only `you` moves. So the scan column survives intact,
 * which is the thing that makes a lone `assumption` findable in forty rows, and
 * the one row type that is genuinely a different *voice* rather than a different
 * *kind* is told apart by position before it is read at all.
 *
 * This is a reversal of what this file used to say, and the reason is the shape
 * of a real conversation rather than a principle. A planner turn is a paragraph
 * and an answer is usually a sentence, so with everything left-aligned and
 * full-width the panel was a single ragged column with a great deal of unused
 * space to the right of it and no rhythm to the exchange. The mirrored row uses
 * that space and makes the alternation legible at a glance.
 *
 * The surface stays with it (`Line surface`), because it solves the other half:
 * scrolling back through a long session, a `you` row differed from a `question`
 * row by one gutter word and a font weight — nothing the eye catches in motion.
 * Position and tint are both caught.
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
 *   specs_preview the plan itself, as a card in the flow (see `proposal`). Only
 *                 the newest one: a revise round replaces the plan, so the
 *                 earlier ones are one-line markers.
 *   applied/aborted/error/closed  terminal
 */

import {
  AlertTriangleIcon,
  ArrowDownIcon,
  CheckIcon,
  CircleSlashIcon,
  LightbulbIcon,
  PauseIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { DiscussFrame, DiscussSession } from "@/entities/discuss";
import { formatClock } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { FOCUS_RING } from "@/shared/ui/focus";
import { Markdown, MarkdownInline } from "@/shared/ui/markdown";
import { Chip } from "@/shared/ui/status-dot";

/** Frames that are state changes rather than things said. `awaiting` and `closed`
 *  are already visible as the composer's shape and the status chip; `progress`
 *  belongs to the live row.
 *
 *  `specs_preview` used to be in here, and taking it out is the point of the
 *  `proposal` slot below: the plan is the thing the conversation exists to
 *  produce, and it was rendered in a column beside the chat while the chat had a
 *  hole where the planner said "here is the plan". */
const RENDERED_ELSEWHERE = new Set(["awaiting", "closed", "progress"]);

/** The DOM id of a question's text, so the action zone can be labelled by it. */
export function questionLabelId(seq: number): string {
  return `planner-question-${seq}`;
}

/**
 * `overflow-wrap: anywhere`, and the distinction from `break-words` is the whole
 * bug this file used to have.
 *
 * Half the text on this screen is machine output — a `turn_failed` row carries
 * the CLI's stderr, which is a 900-character JSON blob with no spaces in it. Both
 * values break such a run mid-token when it would otherwise overflow, but only
 * `anywhere` also reduces the element's **min-content width**. `break-word`
 * leaves it at the length of the longest unbreakable run, so every flex ancestor
 * sized itself to that: the row grew to 1082px inside a 557px column, the log
 * gained a horizontal scrollbar it should never have, and the stderr printed
 * straight over the timestamp in the gutter to its right.
 *
 * Paired with `min-w-0` on the flex wrappers below, for the same reason in the
 * other direction: a flex item defaults to `min-width: auto`, which refuses to
 * shrink past min-content no matter what the wrapping rule says.
 */
const WRAP_ANYWHERE = "whitespace-pre-wrap [overflow-wrap:anywhere]";

/**
 * Machine output inside a message — the CLI's stderr, a close reason. Set as a
 * log block rather than run into the sentence above it: a 900-character JSON
 * blob set as prose is unreadable at any width, and it is the one thing on the
 * row an operator might want to copy.
 *
 * Its left edge is the content column's, which is where the row's glyph starts
 * — so the box sits squarely under the headline block it belongs to rather than
 * stepping in from it. Full width to the right, because the thing inside it is
 * an 900-character run that wants every pixel of measure it can get.
 */
export const LOG_BLOCK =
  "mt-1 block rounded border border-border/60 bg-background/50 px-2 py-1 font-mono text-[11px] leading-relaxed text-muted-foreground";

/**
 * The scan column: who spoke.
 *
 * Only the speaker. The severity glyph used to live in here too, packed against
 * this column's right edge — which read as the first character of the message
 * (glyph, then heading, one unit) while the message's own detail blocks started
 * 22px to the right of it, at the heading. So every one of these rows had two
 * left edges: the block the eye takes as the row, and the text under it, offset
 * by exactly the width of the glyph column. The glyph now opens the message
 * itself (`Line`'s `title`), and nothing in the row is offset from anything.
 *
 * The width is what the content needs — "Planner" is 51px at this size — rather
 * than a round number. It was `w-16` with nothing in it, which is fine against
 * 900px of panel and is a fifth of the width at 300, where the text beside it
 * wrapped every four words.
 */
function Gutter({
  label,
  tone,
  mirrored = false,
}: {
  label: string;
  tone?: "you" | "planner" | undefined;
  /** Sits at the row's right edge, so its content packs against that edge. */
  mirrored?: boolean;
}) {
  return (
    <span
      className={cn(
        "flex w-[3.5rem] shrink-0 items-start pt-px",
        // `justify-end` rather than `text-right`: this is a flex row, and on a
        // mirrored line the label has to sit against the panel's edge, not
        // merely be right-aligned inside a box that is already at it.
        mirrored ? "justify-end" : "justify-start",
      )}
    >
      <span
        className={cn(
          "text-[10px] font-medium uppercase tracking-wider",
          tone === "you" ? "text-foreground/70" : "text-muted-foreground",
        )}
      >
        {label}
      </span>
    </span>
  );
}

/**
 * One row of the conversation.
 *
 * Exported for `stored-transcript.tsx`, which renders a store written before
 * frame logs existed. That reading is a different *source* — a flattened
 * `ROLE: text` blob rather than typed frames — but it is the same conversation
 * on the same screen, and giving it its own row shapes is how the planner page
 * ended up with two visual languages for one thing.
 */
export function Line({
  label,
  tone,
  ts,
  surface = false,
  mine = false,
  icon,
  title,
  children,
}: {
  label: string;
  tone?: "you" | "planner" | undefined;
  ts?: number;
  /** Puts the content on a raised tint — what makes the operator's own turns
   *  findable in peripheral vision while scrolling back through a hundred
   *  machine frames, which a gutter word alone does not. */
  surface?: boolean;
  /**
   * The operator's own turn: the whole row mirrors to the right edge — gutter,
   * timestamp and all — and the content stops filling the row so that a short
   * answer is a short block rather than a full-width band.
   *
   * `flex-row-reverse` and nothing else, so there is exactly one definition of
   * what a row is. The reversal makes the right edge the main-start, which is
   * what packs these against it; the gutter's own text then hangs off that edge
   * rather than floating 40px inside it (`mirrored`).
   */
  mine?: boolean;
  /**
   * The severity glyph. It opens `title`, on the message's own first line —
   * see `Gutter` for why it is no longer a column of its own.
   */
  icon?: React.ReactNode;
  /**
   * The row's headline: what happened, and the chip or glyph that classifies
   * it. Separate from `children` because the glyph has to be *inside* the
   * content column for the rest of the message to sit under it, and only this
   * component knows where that column starts.
   */
  title?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <li className={cn("flex gap-2 px-1 py-2 text-[13px] @lg:gap-3", mine && "flex-row-reverse")}>
      <Gutter label={label} tone={tone} mirrored={mine} />
      {/*
        `max-w-[68ch]`: these rows are as wide as the panel, which on a 1440px
        window with both rails shut is past 110 characters — roughly twice the
        measure prose stays readable at, and the reason a three-line question
        read as a wall.

        `flex-1` on the planner's side only. It is what pushes the timestamp out
        to the far edge of a machine row, which is where it belongs on something
        being scanned. On the operator's side it would do the opposite of what
        the mirroring is for — stretching a four-word answer into a band with
        its timestamp stranded at the other end of the panel — so the block
        sizes to its content and the timestamp travels with it.
      */}
      <div
        className={cn(
          "min-w-0 max-w-[68ch]",
          mine ? "w-fit" : "flex-1",
          WRAP_ANYWHERE,
          surface && "rounded-md bg-foreground/[0.055] px-3 py-1.5",
        )}
      >
        {title === undefined ? null : (
          // The glyph and the headline are one block, and the column starts at
          // the glyph — so everything `children` renders begins under the whole
          // unit rather than under the words half of it.
          //
          // `h-5` on the glyph rather than `items-center` on the row: centring
          // the row would drag the glyph down the middle of a headline that
          // wrapped to three lines. This pins it to the centre of the *first*
          // line, at any measure.
          <span className="flex items-start gap-2">
            {icon ? <span className="flex h-5 shrink-0 items-center">{icon}</span> : null}
            <span className="min-w-0">{title}</span>
          </span>
        )}
        {children}
      </div>
      {ts === undefined ? null : (
        // A third fixed column — gutter, timestamp — on a 300px panel leaves the
        // text about 200px, which is where a question started wrapping every
        // four words. `sr-only` rather than `hidden`: the clock is still the
        // only thing that says how long the loop sat on a turn, so it stays in
        // the accessibility tree and comes back the moment there is room.
        <span className="sr-only shrink-0 pt-1 font-mono text-[11px] tabular-nums text-muted-foreground @md:not-sr-only">
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
      // Verbatim, and it is the only row on this screen that is. Everything the
      // *planner* wrote goes through `Markdown` below; what the operator typed
      // is shown exactly as they typed it — their line breaks survive (the row
      // is `pre-wrap`), an asterisk stays an asterisk, and a pasted glob is not
      // reinterpreted on its way to the screen. Rendering their own input back
      // to them in a different shape from the box they wrote it in is the one
      // place where "helpful formatting" reads as the page having changed what
      // they said.
      return (
        <Line label="You" tone="you" ts={frame.ts} surface mine>
          {String(data.text ?? "")}
        </Line>
      );

    case "assumption":
      return (
        <Line
          label="Planner"
          ts={frame.ts}
          icon={<LightbulbIcon className="size-3.5 text-status-warn" aria-hidden="true" />}
          title={<Chip tone="warn">assumption</Chip>}
        >
          {/* Stacked, not inline. A chip beside prose sets the first line 80px
              in and every wrapped line back at the row's left edge, so the same
              sentence has two left margins — and where the break falls depends
              on the panel width, which is how the badge appeared to move
              against its own text. */}
          <Markdown text={String(data.text ?? "")} className="mt-1 text-muted-foreground" />
        </Line>
      );

    case "question":
      return (
        <Line
          label="Planner"
          ts={frame.ts}
          // Stacked rather than wrapped: with the id inline, a short question
          // sat beside it and a long one dropped under it, so the question text
          // started in a different place from one row to the next.
          title={data.id ? <Chip>{String(data.id)}</Chip> : undefined}
        >
          {/* The id is what the composer points `aria-labelledby` at, so the
              action zone announces the question rather than "edit, blank". */}
          {/* `MarkdownInline`, not `Markdown`: a question is a sentence by
              construction (`config/prompts/planner.md` asks for one), and the
              block renderer would wrap it in a `<p>` whose margins this row
              already provides. It still needs the inline pass — the planner
              names the field it is asking about, and it names it in backticks. */}
          <span
            id={questionLabelId(frame.seq)}
            className={cn("block font-medium", data.id ? "mt-1" : null)}
          >
            <MarkdownInline text={String(data.q ?? "")} />
          </span>
          {data.why ? (
            <span className="mt-0.5 block text-[12px] text-muted-foreground">
              why it matters: <MarkdownInline text={String(data.why)} />
            </span>
          ) : null}
        </Line>
      );

    case "note":
      return (
        <Line label="Loop" ts={frame.ts}>
          <Markdown text={String(data.text ?? "")} className="text-muted-foreground" />
        </Line>
      );

    case "applied":
      return (
        <Line
          label="Loop"
          ts={frame.ts}
          icon={<CheckIcon className="size-3.5 text-status-good" aria-hidden="true" />}
          title={
            <span className="text-status-good">
              Applied {String(data.count ?? 0)} spec(s) to the backlog.
            </span>
          }
        />
      );

    case "aborted":
      return (
        <Line
          label="Loop"
          ts={frame.ts}
          icon={<CircleSlashIcon className="size-3.5 text-muted-foreground" aria-hidden="true" />}
          title={
            <span className="text-muted-foreground">
              Closed — nothing was written.
              {data.reason ? ` (${String(data.reason)})` : null}
            </span>
          }
        />
      );

    case "limit_paused": {
      const resetsAt = typeof data.resets_at === "number" ? data.resets_at : null;
      return (
        <Line
          label="Loop"
          ts={frame.ts}
          icon={<PauseIcon className="size-3.5 text-status-warn" aria-hidden="true" />}
          title={
            <span className="font-medium text-status-warn">
              Subscription limit reached — waiting for the{" "}
              {String(data.limit_type ?? "usage").replace(/_/g, "-")} window.
            </span>
          }
        >
          <span className="mt-0.5 block text-[12px] text-muted-foreground">
            {resetsAt
              ? `Resumes on its own at ${formatClock(resetsAt)}. Nothing is lost — the turn is retried then.`
              : "Resumes on its own once the window resets."}
          </span>
        </Line>
      );
    }

    case "turn_failed":
      return (
        <Line
          label="Loop"
          ts={frame.ts}
          icon={<AlertTriangleIcon className="size-3.5 text-status-warn" aria-hidden="true" />}
          title={<span className="font-medium text-status-warn">That planner turn failed.</span>}
        >
          <span className={LOG_BLOCK}>{String(data.text ?? "")}</span>
          <span className="mt-0.5 block text-[12px] text-muted-foreground">
            The conversation is intact — retrying resends this turn.
          </span>
        </Line>
      );

    // Only ever the *superseded* ones reach this branch — the newest proposal is
    // rendered in full by the `proposal` slot. A revise round replaces the plan
    // wholesale, so re-drawing four dead spec lists in the scrollback would bury
    // the live one under its own history; a one-line marker keeps the place
    // where it happened without keeping the contents.
    case "specs_preview": {
      const count = Array.isArray(data.specs) ? data.specs.length : 0;
      return (
        <Line label="Planner" ts={frame.ts}>
          <span className="text-muted-foreground">
            Proposed {count} spec{count === 1 ? "" : "s"} — replaced by the revision below.
          </span>
        </Line>
      );
    }

    case "error":
      return (
        <Line
          label="Loop"
          ts={frame.ts}
          icon={<AlertTriangleIcon className="size-3.5 text-status-bad" aria-hidden="true" />}
          title={<span className="font-medium text-status-bad">The session failed.</span>}
        >
          <span className={LOG_BLOCK}>{String(data.text ?? "No detail was reported.")}</span>
        </Line>
      );

    default:
      return null;
  }
}

/**
 * A terminal failure the frame log never carried, as the log's closing row.
 *
 * It used to be a `Banner` pinned above the conversation, in a `shrink-0` strip
 * between the header and the scroll region — which cost the conversation 59px of
 * a panel it is supposed to fill, permanently, on the one screen where the
 * conversation *is* the page. It was also the wrong place to read it: the story
 * ends at the bottom, which is where the eye already is and where every other
 * terminal frame lands.
 *
 * Rendered as the last row instead: no height taken from anything, reading order
 * preserved, and the same shape as the `error` frame it stands in for. The
 * status chip in the session column is what stays unscrollable.
 */
function TrailingError({ text }: { text: string }) {
  return (
    <Line
      label="Loop"
      icon={<AlertTriangleIcon className="size-3.5 text-status-bad" aria-hidden="true" />}
      title={<span className="font-medium text-status-bad">The session ended.</span>}
    >
      <span className={LOG_BLOCK}>{text}</span>
    </Line>
  );
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
  //
  // Not put through `Markdown`, unlike every settled planner row. This is a
  // partial token stream: at any instant it can hold one half of a `**` pair or
  // an unclosed backtick, so a markdown pass would re-parse it on every frame
  // and the same sentence would flip in and out of bold as its closing marker
  // arrived. The row is replaced by a real frame the moment the turn lands, and
  // that one is rendered properly.
  const prose = data.phase === "text" && data.text ? String(data.text) : null;
  const tool =
    data.phase === "tool"
      ? data.target
        ? `${String(data.tool)} ${String(data.target)}`
        : String(data.tool ?? "working")
      : null;

  return (
    <div className="flex gap-2 px-1 py-2 text-[13px] @lg:gap-3">
      <Gutter label="Planner" />
      {/* `min-w-0`: without it this flex item sizes to its content, the `truncate`
          below never engages, and a long tool target pushed the row 115px past
          the work column's right edge at 375px.

          The dots open the row exactly where a severity glyph opens a frame, and
          the text sits under both — so the live row has the same shape as the
          frame that is about to replace it and nothing jumps at the swap. */}
      <div className="flex min-w-0 max-w-[68ch] flex-1 items-start gap-2">
        <span
          className="flex h-5 shrink-0 items-center gap-0.5 text-muted-foreground"
          aria-hidden="true"
        >
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
  trailingError = null,
  proposal = null,
  className,
}: {
  session: DiscussSession;
  /** A terminal error the frame log does not already carry — see
   *  `TrailingError`. Null when the log ends with it already. */
  trailingError?: string | null;
  /**
   * The current plan, rendered in place of the newest `specs_preview` row.
   *
   * The page supplies it rather than this file building it, because the
   * decision it carries is the page's. What matters here is only *where* it
   * goes: in the conversation, at the point the planner produced it. It used to
   * live in a fixed column to the right, which cost the chat a third of the
   * screen permanently, put the plan out of reading order, and — since the
   * column was suppressed on narrow frames — hid it behind a sheet at exactly
   * the widths where there was least room to go looking.
   */
  proposal?: React.ReactNode;
  className?: string;
}) {
  const box = useRef<HTMLElement>(null);
  // Whether the operator is at the tail. A ref, not state: it changes on every
  // scroll event and nothing renders from it.
  const following = useRef(true);
  /*
    The other half of not-following, and the half that was missing.

    Holding the view still while the operator reads back is right, but on its own
    it strands them: a planner turn keeps appending, the log keeps growing
    silently below the fold, and the only ways back to the newest frame are a
    scrollbar drag or holding End on a region most operators do not know is
    focusable. Nothing on screen says there is anything down there — so the
    correct behaviour (do not yank) is indistinguishable from the broken one
    (the stream died).

    Unlike `following` this one *is* rendered, so it is state. It is deliberately
    narrower than `!following`: merely having scrolled up is not a reason to put
    a control on the screen, since the operator can see the tail is where they
    left it. It turns on only when a frame has actually arrived while they were
    away, which is exactly the case they cannot otherwise detect.
  */
  const [behind, setBehind] = useState(false);
  const count = session.frames.length;
  /** The one proposal that is still on the table. Every earlier one was replaced
   *  by a revision and is a marker row (see `FrameRow`'s `specs_preview`). */
  const latestProposal = session.frames.findLast((f) => f.kind === "specs_preview")?.seq ?? null;

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
    if (following.current) {
      if (box.current) box.current.scrollTop = box.current.scrollHeight;
    } else {
      // A frame landed somewhere the operator cannot see. This is the only
      // place `behind` is raised — see its declaration for why scrolling up on
      // its own does not.
      setBehind(true);
    }
  }, [count]);

  /** Back to the newest frame, and back into following it. Both, because a
   *  button that returned the view but left `following` false would go quiet
   *  again on the very next frame while sitting at the tail. */
  const jumpToLatest = () => {
    if (box.current) box.current.scrollTop = box.current.scrollHeight;
    following.current = true;
    setBehind(false);
  };

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
        if (!box.current) return;
        const tail = atTail(box.current);
        following.current = tail;
        // Arriving at the tail by hand answers the question the button asks, so
        // it withdraws. React bails out of a set that does not change the value,
        // so this is free on the ordinary scroll where nothing was pending.
        if (tail) setBehind(false);
      }}
      // No border and no fill. This sits inside a `Panel`, which already draws
      // the frame — a second bordered well inside it made the conversation a box
      // in a box, and because the region is `h-full` under a fill panel, a short
      // conversation drew that box around several hundred pixels of nothing.
      // `DESIGN.md` §3.4: a log is Tier 3, content directly on its surface.
      // `overflow-x-clip` is a backstop, not the fix — the rows below wrap
      // properly now (see `WRAP_ANYWHERE`). It is here because `overflow-y: auto`
      // silently computes `overflow-x` to `auto` as well, so *any* future row
      // that overflows by a pixel puts a horizontal scrollbar under a
      // conversation. This log scrolls in one axis by construction; saying so
      // means a regression clips instead of rearranging the screen.
      className={cn("min-h-0 overflow-y-auto overflow-x-clip px-2 py-1", FOCUS_RING, className)}
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
            .map((frame) =>
              proposal !== null && frame.seq === latestProposal ? (
                // No gutter and no `Line`: this is an artifact, not something
                // said. It reads as a card in the flow of the conversation,
                // which is what it is. Capped a little wider than prose —
                // a spec card is a dense object, not a paragraph — but capped,
                // because the alternative on a 1600px panel is file paths
                // stranded four inches from the label above them.
                <li key={frame.seq} className="px-1 py-3">
                  <div className="max-w-[76ch]">{proposal}</div>
                </li>
              ) : (
                <FrameRow key={frame.seq} frame={frame} />
              ),
            )}
          {trailingError ? <TrailingError text={trailingError} /> : null}
        </ul>
        {session.status === "running" ? (
          <Thinking progress={session.frames.findLast((f) => f.kind === "progress")} />
        ) : null}

        {/*
          `sticky`, not `absolute`. The scroll container is the `<section>`
          above, and it is also the element that would have to be
          `position: relative` for an absolute child to anchor to its *frame* —
          but a relative scroll container anchors to its scrolled *content*, so
          the button would sit at the bottom of the log, which is precisely
          where the operator is not. Sticky resolves against the scrollport by
          construction and needs nothing from the ancestor.

          The wrapper is `pointer-events-none` with the button opting back in,
          so this strip does not eat clicks on the last row of the conversation
          when it is on screen. It has zero height in flow (`h-0`), so raising
          it never moves a single row.
        */}
        {behind ? (
          <div className="pointer-events-none sticky bottom-2 z-10 flex h-0 justify-center">
            <Button
              size="xs"
              variant="outline"
              onClick={jumpToLatest}
              className="pointer-events-auto -translate-y-full shadow-sm"
            >
              <ArrowDownIcon aria-hidden="true" />
              Newer messages
            </Button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
