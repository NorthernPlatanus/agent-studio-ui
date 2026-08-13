/**
 * The planner chat — the panel's first job (PLAN §1): hold a `discuss`
 * requirements loop, see the questions, answer, preview the specs, approve.
 *
 * **The screen is a frame, not a document.** It declares `height: "fill"`
 * (`nav-config.ts`), so `<main>` does not scroll and the transcript is the one
 * region that does. Everything else holds still: the header, the action zone at
 * the foot of the conversation, and the session column beside it.
 *
 * That is written down because the previous shape broke it and the break was
 * bad. The page was a `reading`-width stack inside a scrolling column, with the
 * transcript faking containment via `max-h-[58vh]` — a viewport unit in a
 * codebase whose whole responsive story is container queries, because there was
 * nothing to be a percentage *of*. The costs were all downstream of that one
 * workaround: two scrollbars, a tail-follow that drove the one you were not
 * looking at, and — measured on a 1440×900 window with eleven frames and two
 * specs on screen — the composer at y1063 and "Apply to the backlog" at y1014.
 * The irreversible action on the screen was below the fold with nothing to
 * suggest it existed, and it moved *further* away each time the planner
 * proposed something.
 *
 * The layout now says what the screen is:
 *
 *   conversation (scrolls) + its action zone (pinned)  |  the session (still)
 *
 * The second column is not the shared activity rail — that stays shut here. It
 * is this session's own context, in the order attention reaches for it: what the
 * loop is doing, what it decided without asking, what it is proposing, and the
 * knobs that shaped all three. `DESIGN.md` §3.1's two widths did not cover a
 * screen that is watched for ten minutes rather than read once; §6 records the
 * amendment.
 *
 * Live frames arrive on the session's own SSE stream, which appends into the
 * query cache. That is the documented exception to "the stream invalidates, it
 * does not store": the transcript is append-only with a server-assigned `seq`,
 * exactly like the event log.
 */

import { useQueryClient } from "@tanstack/react-query";
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
 * What `run_discuss` wrote to the store on a previous session.
 *
 * The only thing that survives an API restart, and therefore the only history
 * this page can show when the manager has no session in memory. Plain text, not
 * frames — it is the terminal transcript, so it gets the log treatment rather
 * than being dressed up as a conversation it can no longer become.
 */
function PersistedTranscript({ text }: { text: string }) {
  return (
    <Disclosure title="Earlier conversation" meta="persisted transcript, from before a restart">
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

  // Lifted out of the composer because the two halves of the decision live in
  // different columns: the buttons sit with the specs, the revise box sits in
  // the action zone.
  const [revising, setRevising] = useState(false);

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
      {...(session === null
        ? {
            // Only on the screen where this form *is* the screen. In the
            // footer of a finished conversation it would be a third row of
            // metadata under a transcript that already carries all of it.
            context: (
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 px-1 text-[12px] text-muted-foreground">
                <span className="font-mono text-[11px] text-foreground">
                  {options.configured_model}
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono text-[11px]">{options.configured_provider}</span>
                {detail?.repo_path ? (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>reads</span>
                    <FilePath path={detail.repo_path} />
                  </>
                ) : null}
              </p>
            ),
          }
        : {})}
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
  // exists the composer is pinned to the foot of the panel, which the layout
  // fixes and which is right. Starting one from a composer at the top therefore
  // moved everything as far as it could possibly move: measured at 1400×900,
  // the sentence the operator had just typed fell 526px on submit and the box
  // they typed it into was replaced by a differently-shaped strip 600px further
  // down, while a border, a header and a 22rem column appeared around it. Put
  // the empty composer where the real one lives and the same submit reads as
  // the frame growing upward around what was written. The order matches for the
  // same reason: history above, the thing you type below, in both states.
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
        Two frames side by side is a wide-container layout, and only that. Stack
        them and there is no longer enough height to go round: the conversation
        and the session column both want the slack, and at 812px the chat
        collapsed to its border while the session pane took the screen. So below
        `@4xl` this reverts to what it always should have been at that size — a
        document. The wrapper scrolls, the chat keeps a readable floor, and the
        session column flows underneath it.
      */}
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto @4xl:flex-row @4xl:overflow-visible">
        {/*
          ─── the conversation ─────────────────────────────────────────────

          The fade is for the *first* mount only, which is the frame where a
          session starts. Bottom-aligning the start composer got the geometry
          right — the field moves 51px on submit instead of 526 — but three
          things still arrive out of nothing in that same commit: this border,
          its header, and the session column. Appearing over 200ms reads as
          appearing; appearing in one frame reads as the page being replaced.
          Nothing moves, only opacity: motion on a control panel is a cost, and
          this is the smallest thing that removes the blink.
        */}
        <Panel
          fill
          className="min-h-[26rem] min-w-0 flex-1 animate-in fade-in duration-200 motion-reduce:animate-none @4xl:min-h-0"
        >
          {/* The panel's `meta` is the session id and nothing else — the old
              "requirements loop" was a caption on a screen the location chip
              already names `Planner` (`DESIGN.md` §1.3). */}
          <PanelHeader
            title="Planner"
            meta={<span className="font-mono text-xs">{session.session_id}</span>}
          />

          <>
            {/*
              A terminal failure sets `session.error` *and* emits an `error`
              frame carrying the same sentence, so the panel was saying it
              three times: pinned here, as the last row of the conversation,
              and as the `Failed` chip in the session column. Two of those
              earn their place — the row is where the story ends, in reading
              order at the bottom where the eye already is, and the chip is
              unscrollable. This banner was the third, at the top of a panel
              whose content is at the bottom. It stays only for the case the
              row cannot cover: an error the frame log never carried.
            */}
            {session.error && !errorEchoed ? (
              <div className="shrink-0 px-5 pt-4">
                <Banner tone="bad">{session.error}</Banner>
              </div>
            ) : null}

            <PanelBody scroll flush className="px-3 py-3">
              <PlannerTranscript session={session} className="h-full" />
            </PanelBody>

            {/*
                The action zone: whatever "acting" means in this state — the
                pending question's answer box, the retry, the revise note, or the
                form that opens a new session. It is pinned, so it cannot drift
                below the fold as the conversation grows. The one state with
                nothing here is the spec decision, which is deliberate: those
                buttons belong to the specs panel beside this one, under the
                banner that states what they do.
              */}
            {live ? (
              deciding && !revising ? null : (
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
              <PanelFooter className="max-h-[55%] overflow-y-auto">{startForm}</PanelFooter>
            )}
          </>
        </Panel>

        {/* ─── the session ──────────────────────────────────────────────── */}
        {
          // The column is a frame too, for the same reason the page is: the specs
          // panel takes the slack and scrolls its own list, so the button that
          // writes to the store is pinned no matter how many specs are proposed.
          // Letting the whole column scroll instead just moves the off-screen
          // approve button from the bottom of the page to the bottom of the pane.
          <aside
            aria-label="Session"
            className="flex w-full shrink-0 flex-col gap-3 animate-in fade-in duration-200 motion-reduce:animate-none @4xl:min-h-0 @4xl:w-[22rem] @6xl:w-96"
          >
            <Panel className="shrink-0">
              <PanelHeader
                title="Session"
                actions={
                  live ? (
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() => close.mutate()}
                      disabled={close.isPending}
                    >
                      Close
                    </Button>
                  ) : null
                }
              />
              <PanelBody className="space-y-2">
                <StatusChip tone={sessionTone(session.status)}>
                  {describeSession(session)}
                </StatusChip>
                <p className="text-[12px] text-muted-foreground">
                  Started {formatClock(session.started_at)}
                  {running ? ` · ${formatDuration(now - session.started_at)} elapsed` : null}
                </p>
              </PanelBody>
            </Panel>

            {/*
              Open, not folded. An unchallenged assumption becomes a spec, and
              these were previously below the fold behind a `<details>` — which
              is the one place on this screen where "subordinate" was the wrong
              call.
            */}
            {stated.length > 0 ? (
              <Region
                title="Assumptions"
                meta={`${stated.length} · decided rather than asked`}
                // Capped rather than allowed to grow: a long list must not be
                // what pushes the proposal out of the pane. Uncapped when there
                // is no proposal, since then it is the pane's main content.
                className={
                  specs.length > 0
                    ? "max-h-44 shrink-0 overflow-y-auto"
                    : "min-h-0 flex-1 overflow-y-auto"
                }
              >
                <ul className="space-y-1 text-[13px]">
                  {stated.map((text) => (
                    <li key={text} className="flex gap-2">
                      <span className="text-status-warn" aria-hidden="true">
                        •
                      </span>
                      <span className="text-muted-foreground">{text}</span>
                    </li>
                  ))}
                </ul>
              </Region>
            ) : null}

            {specs.length > 0 ? (
              <SpecArtifacts
                fill
                specs={specs}
                title={applied ? "Applied specs" : "Proposed specs"}
                note={
                  applied ? (
                    <Banner tone="good">
                      Written to the backlog. They appear in Tasks as{" "}
                      <span className="font-mono text-xs">ready</span> — or{" "}
                      <span className="font-mono text-xs">human_only</span> where the planner marked
                      them so.
                    </Banner>
                  ) : deciding ? (
                    <Banner tone="warn">
                      Nothing has been written yet. Approving upserts every spec below into the
                      store.
                    </Banner>
                  ) : live ? (
                    // A revise round is in flight. The newest preview is the one
                    // the planner is currently replacing, and saying so is the
                    // difference between "stale" and "wrong".
                    <p className="text-[13px] text-muted-foreground">
                      The proposal from the last round. The planner is working on a revision, which
                      replaces it — nothing has been written.
                    </p>
                  ) : (
                    <p className="text-[13px] text-muted-foreground">
                      Proposed, never approved — this conversation ended without writing them.
                    </p>
                  )
                }
                footer={
                  deciding && !revising ? (
                    <DiscussDecision
                      disabled={busy}
                      onApply={() => reply.mutate("y")}
                      onRevise={() => setRevising(true)}
                      onDiscard={() => reply.mutate("abort")}
                    />
                  ) : null
                }
              />
            ) : null}

            {/*
              Bounded rather than free-growing: folded these are two 28px rows,
              but "Session setup" opens onto a file list and a settings grid, and
              in a column that does not scroll that would push the proposal out
              of view. Capped, it scrolls itself and leaves the rest alone.
            */}
            <div className="max-h-[45%] shrink-0 space-y-3 overflow-y-auto">
              <Disclosure
                title="Session setup"
                meta={
                  live
                    ? `${session.pins.length} attached · settings apply from the next turn`
                    : `${session.pins.length} attached · locked, this session has ended`
                }
              >
                <div className="space-y-3">
                  <DiscussPins
                    pins={session.pins}
                    disabled={!live}
                    pending={uploadPin.isPending || removePin.isPending}
                    error={uploadPin.error ?? removePin.error}
                    maxBytes={options.max_pin_bytes}
                    onUpload={(uploads) => uploadPin.mutate(uploads)}
                    onRemove={(path) => removePin.mutate(path)}
                  />
                  <DiscussSettingsPanel
                    settings={session.settings}
                    options={options}
                    disabled={!live}
                    pending={settings.isPending}
                    onApply={(next) => settings.mutate(next)}
                  />
                </div>
              </Disclosure>

              {persisted === "" ? null : <PersistedTranscript text={persisted} />}
            </div>
          </aside>
        }
      </div>
    </Screen>
  );
}
