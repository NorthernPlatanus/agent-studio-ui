/**
 * The planner chat — the panel's first job (PLAN §1): hold a `discuss`
 * requirements loop, see the questions, answer, read the plan, approve.
 *
 * **One column. The conversation is the page.**
 *
 *   the conversation (scrolls)
 *   ───────────────────────────
 *   what you do next (pinned)
 *
 * That is the whole layout, at every width, in every state. Everything else
 * about the session — its status, what it assumed, what is attached, the knobs
 * for the next turn — is behind one button in the header.
 *
 * This is a correction, and the thing it corrects is worth writing down because
 * the page has now drifted into it twice. The screen kept acquiring a second
 * column: a status panel, a standing list of assumptions, a settings grid, an
 * attachments list, the spec proposal. Each arrived with a good local reason and
 * the sum was a control panel with a chat in the corner — 304 to 384 pixels
 * taken from the conversation, permanently, to hold facts that were already in
 * it. The status panel restated the transcript's closing row. The assumptions
 * region restated rows a few lines up. And the conversation itself had a *hole*
 * where the plan should be, because `specs_preview` was filtered out of the log
 * and drawn in the column instead — so the planner would say nothing at the
 * exact moment it produced the thing you asked for.
 *
 * The rule that replaces all of it: **if it is already a row in the transcript,
 * it does not get a second home on this screen.** Assumptions are rows. The
 * status is the shape of the composer plus a chip in the header. The plan is a
 * card in the flow (`PlannerTranscript`'s `proposal`), where the planner
 * produced it.
 *
 * **The decision is pinned, not parked next to the plan.** The old arrangement
 * put "Apply to the backlog" inside the specs panel, which was right about
 * adjacency and wrong about reachability: the panel scrolled, and past two or
 * three specs the irreversible button was off the bottom of a pane it could not
 * be scrolled back into. It lives in the action zone now — the one strip on this
 * screen that is guaranteed to be on it — directly under the plan it writes,
 * with the consequence stated above the buttons. The specs are always the last
 * thing in the log when a decision is pending, so it is still adjacent; it just
 * cannot leave.
 *
 * **The screen is a frame, not a document.** It declares `height: "fill"`
 * (`nav-config.ts`), so `<main>` does not scroll and the transcript is the one
 * region that does. The header and the action zone hold still. The previous
 * shape faked containment with `max-h-[58vh]` — a viewport unit in a codebase
 * whose responsive story is container queries — which bought two scrollbars, a
 * tail-follow that drove the one you were not looking at, and a composer that
 * drifted below the fold as the conversation grew.
 *
 * Live frames arrive on the session's own SSE stream, which appends into the
 * query cache. That is the documented exception to "the stream invalidates, it
 * does not store": the transcript is append-only with a server-assigned `seq`,
 * exactly like the event log.
 *
 * **A conversation outlives the process that ran it.** Sessions are held in
 * memory by `api.discuss.DiscussManager` and always will be — the loop is an
 * awaited coroutine holding a provider subprocess. Restarting the API used to
 * blank this screen to a start form: the reading was gone along with the loop,
 * which is the wrong half to lose. The API now persists the frame log
 * (`store.save_discussion_log`) and rebuilds a read-only session from it, so a
 * restart costs the turn and not the transcript. `PersistedTranscript` below is
 * what remains for stores written before that.
 */

import { useQueryClient } from "@tanstack/react-query";
import { SlidersHorizontalIcon } from "lucide-react";
import { useEffect, useState } from "react";
import {
  assumptions,
  type DiscussSettings,
  describeSession,
  discussKeys,
  expects,
  isSessionLive,
  isThinking,
  proposedSpecs,
  sessionTone,
} from "@/entities/discuss";
import {
  openDiscussStream,
  useCloseDiscuss,
  useDiscussReply,
  useDiscussSettings,
  useDiscussState,
  useRemovePin,
  useStartDiscuss,
  useUploadPin,
} from "@/entities/discuss/api";
import {
  DiscussComposer,
  DiscussDecision,
  DiscussPins,
  DiscussSettingsPanel,
  StartDiscuss,
} from "@/features/discuss-session";
import { useActiveProject } from "@/features/project-switch";
import { ApiError } from "@/shared/api/client";
import { useNow } from "@/shared/hooks";
import { formatClock, formatDuration } from "@/shared/lib/format";
import { Banner } from "@/shared/ui/banner";
import { Button } from "@/shared/ui/button";
import { Disclosure } from "@/shared/ui/disclosure";
import { FilePath } from "@/shared/ui/file-path";
import { Panel, PanelBody, PanelFooter, PanelHeader } from "@/shared/ui/panel";
import { Region } from "@/shared/ui/region";
import { Screen } from "@/shared/ui/screen";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/shared/ui/sheet";
import { Skeleton } from "@/shared/ui/skeleton";
import { StatusChip } from "@/shared/ui/status-dot";
import {
  activity,
  PlannerTranscript,
  questionLabelId,
  SpecArtifacts,
  TurnHeartbeat,
} from "@/widgets/planner-chat";

/**
 * The flattened transcript, for a store written before frame logs existed.
 *
 * The server sends this **only** when it has no session to give — with a frame
 * log present it returns the conversation properly and leaves this empty, so
 * the two can never appear together. That pairing was the bug: the same
 * exchange rendered once as a chat and once as a `ROLE: text` dump beside it.
 *
 * Plain text, so it gets the log treatment rather than being dressed up as a
 * conversation it can no longer become — and folded, because it is the one
 * thing on an otherwise-empty screen that must not outweigh the composer.
 */
function PersistedTranscript({ text }: { text: string }) {
  return (
    <Disclosure title="Earlier conversation" meta="from before this store kept frames">
      <pre className="max-h-72 overflow-auto rounded-lg border border-border bg-background/50 px-3 py-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
        {text}
      </pre>
    </Disclosure>
  );
}

export function PlannerPage() {
  const { project, detail } = useActiveProject();
  const queryClient = useQueryClient();
  const state = useDiscussState(project);
  const session = state.data?.session ?? null;
  const sessionId = session?.session_id;

  const start = useStartDiscuss(project);
  const reply = useDiscussReply(project, sessionId);
  const settings = useDiscussSettings(project, sessionId);
  const uploadPin = useUploadPin(project, sessionId);
  const removePin = useRemovePin(project, sessionId);
  const close = useCloseDiscuss(project, sessionId);

  // Lifted out of the composer because the decision has two halves in two
  // places: the buttons and the revise box swap for one another in the action
  // zone, and the specs panel's own copy of the state decides what its note says.
  const [revising, setRevising] = useState(false);

  // Everything about the session that is not the conversation — see
  // `sessionSheet`.
  const [sheetOpen, setSheetOpen] = useState(false);

  // One subscription per live session. Re-opened only when the session id
  // changes — not on every frame — because the stream itself is what mutates the
  // cached session, and re-subscribing on its own output would never settle.
  const live = isSessionLive(session);
  useEffect(() => {
    if (project === null || sessionId === undefined || !live) return;
    return openDiscussStream(queryClient, project, sessionId, {
      since: 0,
      onClosed: () => {
        void queryClient.invalidateQueries({ queryKey: discussKeys.state(project) });
      },
    });
    // `live` is intentionally read once per session: it flips false when the
    // `closed` frame lands, and tearing the stream down from inside its own
    // handler is what `onClosed` is for.
  }, [queryClient, project, sessionId, live]);

  // A new session must never inherit the previous one's revise box.
  // biome-ignore lint/correctness/useExhaustiveDependencies: sessionId is the trigger, not an input.
  useEffect(() => setRevising(false), [sessionId]);

  const running = session?.status === "running";
  const now = useNow(running);

  if (state.error instanceof ApiError && state.error.status === 409) {
    return (
      <Screen>
        <Banner tone="info">
          <span className="font-medium">{project}</span> has no store yet, so there is no backlog
          for the planner to work from. Import the backlog first.
        </Banner>
      </Screen>
    );
  }

  if (state.isPending) {
    return (
      <Screen>
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </Screen>
    );
  }

  if (state.error) {
    return (
      <Screen>
        <Banner tone="bad">Could not read the planner session.</Banner>
      </Screen>
    );
  }

  const options = state.data.options;
  const specs = proposedSpecs(session);
  const stated = assumptions(session);
  const waiting = expects(session);
  const thinking = isThinking(session);
  const persisted = state.data.transcript;

  const deciding = waiting === "decision";
  const applied = session?.status === "done";
  const busy = thinking || reply.isPending;

  // The question the action zone is answering, for `aria-labelledby`. Only when
  // one is actually pending: labelling a revise box with a question the operator
  // has already moved past would be worse than the generic label.
  const pending =
    waiting === "answer" ? session?.frames.findLast((f) => f.kind === "question") : undefined;

  // Whether the conversation already ends with the sentence `session.error`
  // holds. Compared by text rather than assumed: a session can fail in a way
  // that never reached the frame log, and that error has nowhere else to go.
  const errorEchoed =
    session !== null &&
    session.error !== null &&
    session.frames.some((f) => f.kind === "error" && f.data.text === session.error);

  const startForm = (
    <StartDiscuss
      heading={session === null ? "What do you want built?" : "Start a new session"}
      blockedByJob={state.data.blocked_by_job ?? null}
      runnable={detail?.runnable === true}
      runnableDetail={detail?.runnable_detail}
      pending={start.isPending}
      error={start.error}
      context={
        // What the session will run as, and what it reads — the only question an
        // operator has before pressing the button.
        //
        // **Set as two ends of one row, not a left-packed list.** All five values
        // used to run left-to-right off the composer's left edge under a
        // 38rem-wide box, which left a third of the row empty and made the whole
        // block read as leaning. They are also two different kinds of fact: one
        // is where the tokens are spent, the other is what they are spent
        // reading. The row now says so — the checkout at the left margin, the
        // spend at the right, each aligned to the edge of the field above it.
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-1 text-[12px] text-muted-foreground">
          {detail?.repo_path ? (
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="shrink-0">reads</span>
              <FilePath path={detail.repo_path} />
            </span>
          ) : (
            <span />
          )}
          <span className="flex shrink-0 items-center gap-1.5 font-mono text-[11px]">
            <span className="text-foreground">{options.configured_model}</span>
            <span aria-hidden="true">·</span>
            <span>{options.configured_effort ?? "default"} effort</span>
            <span aria-hidden="true">·</span>
            <span>{options.configured_provider}</span>
          </span>
        </div>
      }
      onStart={(request, confirm, uploads) =>
        start.mutate({ request, confirm, settings: {} as DiscussSettings, uploads })
      }
    />
  );

  // No `Panel` when there is no session. A titled bordered region is Tier 1 —
  // "a discrete thing with its own actions" — and wrapping one composer in a
  // frame that fills the work column drew a border around six hundred pixels of
  // nothing, with a "Planner" header duplicating the location chip above it.
  //
  // **Bottom-aligned, and that is the whole point of it.** Once a session
  // exists the composer is pinned to the foot of the panel. Starting one from a
  // composer at the top therefore moved everything as far as it could possibly
  // move: measured at 1400×900, the sentence the operator had just typed fell
  // 526px on submit and the box they typed it into was replaced by a
  // differently-shaped strip 600px further down. Put the empty composer where
  // the real one lives and the same submit reads as the frame growing upward
  // around what was written.
  if (session === null) {
    return (
      <Screen fill>
        <TurnHeartbeat running={false} activity={null} />
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex min-h-full w-full max-w-[38rem] flex-col justify-end gap-5 pt-10 pb-3">
            {persisted === "" ? null : <PersistedTranscript text={persisted} />}
            {startForm}
          </div>
        </div>
      </Screen>
    );
  }

  /*
    The plan, rendered inside the conversation at the point it was produced.

    `fill` is deliberately off: the panel is in a scrolling log now, not a
    fixed-height column, so it has no slack to take and nothing to scroll
    internally. Its length is the log's length, which is the one place on this
    screen where length is free.

    No `footer` either. The decision moved to the action zone — see the file
    header for why adjacency lost to reachability.
  */
  const proposal =
    specs.length === 0 ? null : (
      <SpecArtifacts
        specs={specs}
        title={applied ? "Applied specs" : "Proposed specs"}
        note={
          applied ? (
            <Banner tone="good">
              Written to the backlog. They appear in Tasks as{" "}
              <span className="font-mono text-xs">ready</span> — or{" "}
              <span className="font-mono text-xs">human_only</span> where the planner marked them
              so.
            </Banner>
          ) : deciding && !revising ? (
            <p className="text-[13px] text-muted-foreground">
              Nothing has been written yet. The decision is below the conversation.
            </p>
          ) : deciding ? (
            // Revising. What is true here is that this list is about to be
            // replaced by whatever is being typed, which is more useful than a
            // warning about a button that is not currently on the screen.
            <p className="text-[13px] text-muted-foreground">
              Still nothing written. What you send next is a revision — the planner replaces this
              proposal with it rather than applying it.
            </p>
          ) : live ? (
            // A revise round is in flight. The newest preview is the one the
            // planner is currently replacing, and saying so is the difference
            // between "stale" and "wrong".
            <p className="text-[13px] text-muted-foreground">
              The proposal from the last round. The planner is working on a revision, which replaces
              it — nothing has been written.
            </p>
          ) : (
            <p className="text-[13px] text-muted-foreground">
              Proposed, never approved — this conversation ended without writing them.
            </p>
          )
        }
      />
    );

  /*
    ─── the sheet ────────────────────────────────────────────────────────────

    Everything about the session that is not the conversation. One button, one
    surface, and nothing on the screen behind it moves when it opens.

    What is in here is in here because the alternative is a standing column, and
    a standing column is what this page keeps regressing into. Each of these is
    real and none of them is what the operator is doing:

      status        the chip in the header is the glanceable half; the clock and
                    the session id are the half you only want when something has
                    gone strange
      assumptions   already inline as rows — collected here because an
                    unchallenged assumption becomes a spec, so it is worth being
                    able to read the set of them without scrolling the log
      attachments   what this conversation was given
      settings      what the *next* turn will run as

    Settings and attachments used to be a `<details>` at the foot of the session
    column, and opening it was the worst interaction on this screen: the column
    was a fixed-height frame whose specs panel took the slack, so unfolding a
    file list collapsed the proposal being decided to a header and a footer with
    nothing between them. A sheet has room by construction and takes nothing
    from anything.
  */
  const sessionSheet = (
    <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-md">
        <SheetHeader className="shrink-0 gap-1 border-b border-border pr-12">
          <SheetTitle className="text-sm">Session</SheetTitle>
          <SheetDescription className="text-[12px]">
            {live
              ? "Attachments and settings apply from the next planner turn."
              : "This session has ended — everything here is read-only."}
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          <dl className="space-y-1 text-[12px]">
            <div className="flex gap-2">
              <dt className="w-20 shrink-0 text-muted-foreground">Started</dt>
              <dd>
                {formatClock(session.started_at)}
                {running ? ` · ${formatDuration(now - session.started_at)} elapsed` : null}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-20 shrink-0 text-muted-foreground">Id</dt>
              {/* Developer-facing, so it is here rather than in the header
                  where it used to sit as the panel's only `meta` — displacing
                  the one fact an operator reads at a glance, which is whether
                  the loop is waiting on them. */}
              <dd className="min-w-0 break-all font-mono text-[11px]">{session.session_id}</dd>
            </div>
          </dl>

          {stated.length === 0 ? null : (
            <Region title="Assumptions" meta={`${stated.length} · decided rather than asked`}>
              <ul className="space-y-1 text-[13px]">
                {stated.map((text) => (
                  <li key={text} className="flex gap-2">
                    <span className="text-status-warn" aria-hidden="true">
                      •
                    </span>
                    <span className="min-w-0 text-muted-foreground">{text}</span>
                  </li>
                ))}
              </ul>
            </Region>
          )}

          {/* Only if something was attached, or there is still a turn to attach
              for. An attachments list reading "none" on a loop that has stopped
              reading is a control explaining an absence. */}
          {live || session.pins.length > 0 ? (
            <DiscussPins
              pins={session.pins}
              disabled={!live}
              pending={uploadPin.isPending || removePin.isPending}
              error={uploadPin.error ?? removePin.error}
              maxBytes={options.max_pin_bytes}
              onUpload={(uploads) => uploadPin.mutate(uploads)}
              onRemove={(path) => removePin.mutate(path)}
            />
          ) : null}

          {/* Only while there is a turn left for them to affect. A disabled copy
              of this grid is six controls explaining how they would have steered
              a loop that has stopped. */}
          {live ? (
            <DiscussSettingsPanel
              settings={session.settings}
              options={options}
              disabled={false}
              pending={settings.isPending}
              onApply={(next) => settings.mutate(next)}
            />
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );

  return (
    <Screen fill>
      {/*
        The spoken channel for a turn that runs 334–539s. Always mounted, even
        when idle — a live region that appears in the same commit as its text is
        unreliably announced. See `turn-heartbeat.tsx`.
      */}
      <TurnHeartbeat
        running={running}
        activity={activity(session?.frames.findLast((f) => f.kind === "progress"))}
      />

      {/*
        The fade is for the *first* mount only, which is the frame where a
        session starts. Bottom-aligning the start composer got the geometry
        right — the field moves 51px on submit instead of 526 — but the border
        and its header still arrive out of nothing in that same commit.
        Appearing over 200ms reads as appearing; appearing in one frame reads as
        the page being replaced. Nothing moves, only opacity.
      */}
      <Panel fill className="animate-in fade-in duration-200 motion-reduce:animate-none">
        {/*
          The header's `meta` is the session's state in three words, because
          that is the one thing about a planner session that is worth a
          permanent, unscrollable slot: whether it is your turn. It replaces a
          19rem column that said the same thing in a bordered panel with a
          heading over it.
        */}
        <PanelHeader
          title="Planner"
          meta={
            <span className="flex items-center gap-2">
              <StatusChip tone={sessionTone(session.status)}>{describeSession(session)}</StatusChip>
              {running ? (
                <span className="tabular-nums">{formatDuration(now - session.started_at)}</span>
              ) : null}
            </span>
          }
          actions={
            <>
              <Button
                size="xs"
                variant="ghost"
                aria-haspopup="dialog"
                aria-expanded={sheetOpen}
                onClick={() => setSheetOpen(true)}
              >
                <SlidersHorizontalIcon aria-hidden="true" />
                Session
              </Button>
              {/* Only while there is something to close. On an ended session
                  this was a button whose whole effect had already happened. */}
              {live ? (
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => close.mutate()}
                  disabled={close.isPending}
                >
                  Close
                </Button>
              ) : null}
            </>
          }
        />

        {/*
          A terminal failure sets `session.error` *and* usually emits an `error`
          frame carrying the same sentence. Two statements of it earn their
          place — the log's own closing row, in reading order at the bottom
          where the eye already is, and the chip in the header, which is
          unscrollable. A third as a pinned banner cost the conversation a
          measured 59px permanently to restate at the top something whose
          content is at the bottom. The case it existed for — an error the frame
          log never carried — goes to `trailingError` instead.
        */}
        <PanelBody scroll flush className="px-3 py-3">
          <PlannerTranscript
            session={session}
            trailingError={session.error && !errorEchoed ? session.error : null}
            proposal={proposal}
            className="h-full"
          />
        </PanelBody>

        {/*
          ─── the action zone ────────────────────────────────────────────────

          Whatever "acting" means in this state: the pending question's answer
          box, the retry, the decision on a plan, the revise note, or the form
          that opens a new session. Pinned, so it cannot drift below the fold as
          the conversation grows — which is the property the decision bar was
          moved here to get.
        */}
        {live ? (
          deciding && !revising ? (
            <PanelFooter className="space-y-2.5">
              <Banner tone="warn">
                Nothing has been written yet. Approving upserts every spec in the proposal above
                into the store.
              </Banner>
              <DiscussDecision
                disabled={busy}
                onApply={() => reply.mutate("y")}
                onRevise={() => setRevising(true)}
                onDiscard={() => reply.mutate("abort")}
              />
            </PanelFooter>
          ) : (
            <PanelFooter>
              <DiscussComposer
                expects={waiting}
                disabled={busy}
                revising={revising}
                onRevisingChange={setRevising}
                onSend={(text) => reply.mutate(text)}
                labelledBy={pending ? questionLabelId(pending.seq) : undefined}
              />
              {reply.error instanceof ApiError ? (
                <Banner tone="bad" className="mt-3">
                  {typeof reply.error.detail === "string"
                    ? reply.error.detail
                    : "That reply was not accepted."}
                </Banner>
              ) : null}
            </PanelFooter>
          )
        ) : (
          // Capped at 40%, not 55%. The start form is the tallest thing this
          // action zone ever holds — heading, field, two control rows and the
          // context line — and at 55% it was entitled to more than half the
          // panel on a screen whose subject is the conversation above it.
          // Measured on an 820px panel it wants 196px, so 40% (328px) is slack
          // rather than a squeeze at any ordinary height; below that it scrolls
          // itself, and the conversation keeps the majority of the frame at
          // every size.
          <PanelFooter className="max-h-[40%] overflow-y-auto">{startForm}</PanelFooter>
        )}
      </Panel>

      {sessionSheet}
    </Screen>
  );
}
