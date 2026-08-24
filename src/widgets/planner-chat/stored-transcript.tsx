/**
 * The conversation, rebuilt from a store written before frame logs existed.
 *
 * **Why this is not a `<pre>`.** The planner page has exactly one job — talking
 * to the planner — and on a store with no frame log the whole page was a
 * monospace dump of `ROLE: text` lines with a start form under it. That is the
 * regression the operator reported as "there was a chat, now there is just some
 * info and no chat": on the project they actually use, the *only* state this
 * screen ever reaches is this one, because `discussions.frames` is added by a
 * migration that runs on the first store **write** and reading the page is not
 * one. So the fallback is not a rare degraded corner; for an existing project it
 * is the planner page, until they start a session they cannot see the point of
 * starting.
 *
 * **Why the previous file said not to do this, and what changed.** The old
 * comment argued a parser would "dress up user turns and nested
 * `(resumed session)` wrappers as a conversation that does not exist". The
 * concern is right and the conclusion was too strong. Nothing here is invented:
 *
 *   - a `USER:` turn is the operator's own message, rendered in the same row the
 *     live chat gives it — that is what it is, not a reconstruction;
 *   - `(resumed session)` is a prompt-assembly marker, so it is drawn as what it
 *     is (a divider saying the loop resumed) rather than as something said, and
 *     consecutive ones collapse — the store this was written against opens with
 *     four of them;
 *   - a `PLANNER:` turn is `json.dumps(env)` (`nodes/discuss.py`), so its
 *     questions, assumptions **and specs** are read out of the envelope and
 *     anything unparseable falls back to the raw blob in a log block.
 *
 * **The plan is in here, and it used to say it was not.** `env.specs` is the
 * whole proposal — the same `id`/`title`/`files_write`/`risk` objects the live
 * conversation renders as `SpecArtifacts` cards — and this file counted them and
 * printed "the plan itself was not kept in this format". On the store this was
 * written against that sentence sat on top of four complete specs. It was the
 * single most valuable thing in the reading, thrown away by a component
 * describing an absence that was not there. The newest proposal now gets the
 * same card the live log gives it, in the same place; the ones a later round
 * replaced get the same one-line marker (`PlannerTranscript`'s `specs_preview`),
 * so a revise chain does not bury the surviving plan under its own history.
 *
 * What the format genuinely cannot give back is stated on the screen rather than
 * inferred from an absence — see `missingHalf`. A conversation shown honestly
 * with a gap named is better than the same text with the gap plus no shape.
 *
 * The nesting needs no recursion: `_format` writes the prior transcript *inside*
 * a system turn, but it writes it in the same `ROLE:` form, so a flat pass over
 * the lines already yields the turns in order.
 */

import { InfoIcon, RotateCcwIcon } from "lucide-react";
import { Fragment } from "react";
import type { ProposedSpec } from "@/entities/discuss";
import { cn } from "@/shared/lib/utils";
import { FOCUS_RING } from "@/shared/ui/focus";
import { MarkdownInline } from "@/shared/ui/markdown";
import { Chip } from "@/shared/ui/status-dot";
import { Line, LOG_BLOCK } from "./planner-transcript";
import { SpecArtifacts } from "./spec-artifacts";

/** The roles `nodes/discuss._format` can emit, plus the two markers it appends. */
export type StoredRole = "you" | "planner" | "resumed" | "applied";

export type StoredTurn = {
  /** Position in the blob — stable, and the only id these have. */
  key: number;
  role: StoredRole;
  text: string;
  /** How many consecutive resume markers this row stands for. */
  count?: number;
};

/**
 * A role prefix, restricted to the three `_format` writes.
 *
 * Deliberately not `/^[A-Z]+:/`: an operator's own message routinely contains a
 * line like `NOTE: don't retune this`, and a permissive pattern would split
 * their paragraph into two turns and attribute half of it to a role that was
 * never in the conversation.
 */
const ROLE_LINE = /^(SYSTEM|USER|PLANNER): ?(.*)$/;

/** `save_discussion` appends this bare word when a session applied its specs. */
const APPLIED_TAIL = "APPLIED";

export function parseStoredTranscript(source: string): StoredTurn[] {
  const turns: StoredTurn[] = [];
  let key = 0;
  let role: StoredRole | null = null;
  let lines: string[] = [];

  const flush = () => {
    if (role === null) return;
    const text = lines.join("\n").trim();
    if (role === "resumed") {
      // One row for a run of them. Four identical markers at the top of a
      // conversation say the same thing once.
      const last = turns.at(-1);
      if (last?.role === "resumed") last.count = (last.count ?? 1) + 1;
      else turns.push({ key: key++, role: "resumed", text: "", count: 1 });
    } else if (text !== "") {
      turns.push({ key: key++, role, text });
    }
    role = null;
    lines = [];
  };

  let body = source.replace(/\s+$/, "");
  let applied = false;
  if (body.endsWith(`\n${APPLIED_TAIL}`) || body === APPLIED_TAIL) {
    applied = true;
    body = body.slice(0, body.length - APPLIED_TAIL.length).replace(/\s+$/, "");
  }

  for (const line of body.split("\n")) {
    const match = ROLE_LINE.exec(line);
    if (match === null) {
      // A continuation of the turn above — or, before any prefix at all, text
      // from a store shape this parser does not know. Either way it is kept.
      if (role === null) {
        role = "planner";
        lines = [];
      }
      lines.push(line);
      continue;
    }
    flush();
    const [, prefix, rest] = match as unknown as [string, string, string];
    if (prefix === "USER") role = "you";
    else if (prefix === "PLANNER") role = "planner";
    else role = rest.startsWith("(resumed session)") ? "resumed" : "planner";
    if (role !== "resumed" && rest !== "") lines.push(rest);
  }
  flush();

  if (applied) turns.push({ key: key++, role: "applied", text: "" });
  return turns;
}

type Question = { id?: string | undefined; q: string; why?: string | undefined };

/**
 * A `PLANNER:` turn, which is the raw envelope the loop sent itself.
 *
 * Returns null for anything that is not an object with something in it, so the
 * caller can print the blob instead of an empty row that implies the planner
 * said nothing.
 */
export function plannerEnvelope(
  text: string,
): { assumptions: string[]; questions: Question[]; specs: ProposedSpec[] } | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
  const env = parsed as Record<string, unknown>;
  const assumptions = (Array.isArray(env.assumptions) ? env.assumptions : [])
    .filter((a): a is string => typeof a === "string")
    .map((a) => a.trim())
    .filter((a) => a !== "");
  const questions = (Array.isArray(env.questions) ? env.questions : [])
    .filter((q): q is Record<string, unknown> => typeof q === "object" && q !== null)
    .map((q) => ({
      id: typeof q.id === "string" ? q.id : undefined,
      q: typeof q.q === "string" ? q.q : "",
      why: typeof q.why === "string" ? q.why : undefined,
    }))
    .filter((q) => q.q !== "");
  // Kept whole, not counted. These are the same open blobs `SpecArtifacts`
  // renders from a live `specs_preview` frame — `ProposedSpec` is
  // `Record<string, unknown>` precisely so a spec written by an older planner
  // still draws, with the fields it happens to carry.
  const specs = (Array.isArray(env.specs) ? env.specs : []).filter(
    (spec): spec is ProposedSpec =>
      typeof spec === "object" && spec !== null && !Array.isArray(spec),
  );
  if (assumptions.length === 0 && questions.length === 0 && specs.length === 0) return null;
  return { assumptions, questions, specs };
}

/**
 * The proposal, as its own row rather than nested in the planner's message.
 *
 * Same shape the live log gives it (`PlannerTranscript`'s `proposal` slot): no
 * gutter, because a plan is an artifact rather than something said, and capped a
 * little wider than prose because a spec card is a dense object. Matching that
 * exactly is the point — one visual language for one thing, whichever source the
 * conversation came from.
 */
function StoredProposal({ specs, applied }: { specs: ProposedSpec[]; applied: boolean }) {
  return (
    <li className="px-1 py-3">
      <div className="max-w-[76ch]">
        <SpecArtifacts
          specs={specs}
          title="Proposed specs"
          note={
            <p className="text-[13px] text-muted-foreground">
              {applied
                ? // Deliberately not "these were applied". The blob records a planner
                  // turn only on a round that ended in a question or an edit
                  // (`nodes/discuss.py`), so the envelope that was actually approved
                  // was never written here — this is the last one that was, and the
                  // approved plan may have differed. Claiming otherwise would put a
                  // confident wrong list under a green marker.
                  "The last proposal this format kept. That conversation ended by applying a plan — what went into the backlog is in Tasks, and may differ from this."
                : "Proposed in an earlier conversation, which ended without applying it. Nothing here can be written now — start a new session below."}
            </p>
          }
        />
      </div>
    </li>
  );
}

function StoredRow({
  turn,
  /** This turn holds the newest proposal, so its specs are drawn in full by the
   *  row after it rather than summarised as a replaced one. */
  latest = false,
}: {
  turn: StoredTurn;
  latest?: boolean;
}) {
  switch (turn.role) {
    case "you":
      // Verbatim and mirrored, exactly as a live `you` frame — same reason.
      return (
        <Line label="You" tone="you" surface mine>
          {turn.text}
        </Line>
      );

    case "resumed":
      return (
        <Line
          label="Loop"
          icon={<RotateCcwIcon className="size-3.5 text-muted-foreground" aria-hidden="true" />}
          title={
            <span className="text-muted-foreground">
              {turn.count && turn.count > 1
                ? `Resumed an earlier session (${turn.count} times).`
                : "Resumed an earlier session."}
            </span>
          }
        />
      );

    case "applied":
      return (
        <Line
          label="Loop"
          title={<span className="text-status-good">These specs were applied to the backlog.</span>}
        />
      );

    default: {
      const env = plannerEnvelope(turn.text);
      if (env === null) {
        return (
          <Line label="Planner">
            <span className={LOG_BLOCK}>{turn.text}</span>
          </Line>
        );
      }
      return (
        <Line label="Planner">
          {env.assumptions.map((text) => (
            <span key={text} className="mt-1 block text-muted-foreground">
              <Chip tone="warn">assumption</Chip>{" "}
              <span className="align-middle">
                <MarkdownInline text={text} />
              </span>
            </span>
          ))}
          {env.questions.map((question) => (
            <span key={`${question.id ?? ""}${question.q}`} className="mt-1 block">
              {question.id ? <Chip>{question.id}</Chip> : null}
              <span className="mt-0.5 block font-medium">
                <MarkdownInline text={question.q} />
              </span>
              {question.why ? (
                <span className="mt-0.5 block text-[12px] text-muted-foreground">
                  why it matters: <MarkdownInline text={question.why} />
                </span>
              ) : null}
            </span>
          ))}
          {/* Only the superseded ones say this. The surviving proposal is drawn
              in full as its own row — see `StoredProposal`. */}
          {env.specs.length > 0 && !latest ? (
            <span className="mt-1 block text-muted-foreground">
              Proposed {env.specs.length} spec{env.specs.length === 1 ? "" : "s"} — replaced by the
              revision below.
            </span>
          ) : null}
        </Line>
      );
    }
  }
}

/**
 * The banner that opens the reading.
 *
 * Two different sentences, because two different things are true. A store that
 * kept the planner's envelopes is a whole conversation in an older container; a
 * store with nothing but `USER:` lines is half of one, and saying so is the
 * difference between an operator reading their own words back and wondering
 * whether the planner ever answered.
 */
function missingHalf(turns: StoredTurn[]): string {
  return turns.some((turn) => turn.role === "planner")
    ? "Saved before this panel kept full logs. The planner's replies are here from the rounds that ended in a question or an edit — the rounds it ended by applying or aborting were not recorded. Replying is not possible; start a new session below."
    : "Saved before this panel kept full logs, which kept only your own messages. The planner's replies are not recoverable. Start a new session below to talk to it again.";
}

/**
 * The index of the turn holding the proposal that was never replaced.
 *
 * Newest wins, exactly as `proposedSpecs` does for a live session and for the
 * same reason: an edit round replaces the plan wholesale, so drawing four dead
 * spec lists in the scrollback buries the one that survived under its own
 * history. `-1` when no stored turn carries a spec at all.
 */
function latestProposalAt(turns: StoredTurn[]): number {
  for (let index = turns.length - 1; index >= 0; index -= 1) {
    const turn = turns[index];
    if (turn?.role !== "planner") continue;
    if ((plannerEnvelope(turn.text)?.specs.length ?? 0) > 0) return index;
  }
  return -1;
}

/**
 * Bottom-aligned like the live log, so the newest turn sits just above the start
 * form rather than at the top of several hundred pixels of empty panel — and
 * scrollable in one axis, for the same reasons `PlannerTranscript` documents.
 */
export function StoredTranscript({ text, className }: { text: string; className?: string }) {
  const turns = parseStoredTranscript(text);
  const latest = latestProposalAt(turns);
  const applied = turns.some((turn) => turn.role === "applied");

  // Nothing recognisable in it. Better the raw blob than a blank panel claiming
  // there is a conversation here.
  if (turns.length === 0) {
    return (
      <pre className="whitespace-pre-wrap px-3 py-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
        {text}
      </pre>
    );
  }

  return (
    <section
      // Same rationale as the live transcript's region: a scroll container with
      // no focusable descendants is unreachable by keyboard unless it is
      // focusable itself (WCAG 2.1.1).
      // biome-ignore lint/a11y/noNoninteractiveTabindex: see above.
      tabIndex={0}
      aria-label="Earlier planner conversation"
      // `FOCUS_RING` for the same reason the live log carries it and not as a
      // flourish: this element is in the tab order *only* because a scroll
      // container with no focusable descendants cannot be scrolled by keyboard
      // otherwise, and a tab stop with no visible indicator is a 2.4.7 failure.
      // It was the one thing this branch did not copy from `PlannerTranscript`,
      // so a keyboard operator on a pre-frame-log store — which is every
      // existing project — landed on the conversation with nothing on screen
      // saying so.
      className={cn("min-h-0 overflow-y-auto overflow-x-clip px-2 py-1", FOCUS_RING, className)}
    >
      <div className="flex min-h-full flex-col justify-end">
        <ul className="divide-y divide-border">
          <Line
            label="Loop"
            icon={<InfoIcon className="size-3.5 text-muted-foreground" aria-hidden="true" />}
            title={<span className="text-muted-foreground">{missingHalf(turns)}</span>}
          />
          {turns.map((turn, index) => {
            const isLatest = index === latest;
            return (
              <Fragment key={turn.key}>
                <StoredRow turn={turn} latest={isLatest} />
                {/* After the message, not inside it: the planner said something
                    and then produced a plan, and that is the order the live log
                    puts them in too. */}
                {isLatest ? (
                  <StoredProposal
                    specs={plannerEnvelope(turn.text)?.specs ?? []}
                    applied={applied}
                  />
                ) : null}
              </Fragment>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
