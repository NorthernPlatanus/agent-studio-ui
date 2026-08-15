/**
 * The planner chat's state machine: question → answer → preview → apply/abort
 * (PLAN §4.5).
 *
 * Sessions are scripted here rather than captured, and they have to be: opening
 * a real one calls the planner, which measured at 385–425k input tokens for its
 * first turn. The *idle* state is the captured fixture; everything past it is
 * built on the same schema.
 *
 * The behaviour most worth pinning is the decision step. The loop reads one
 * string per turn and, at the preview, treats anything that is not `y`/`abort`
 * as an edit note — so a free-text box there would let "looks good" send the
 * planner back for another full round instead of approving. The composer must
 * offer buttons, not a textarea.
 */

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { RouterProvider } from "react-router";
import { describe, expect, it, vi } from "vitest";
import type { DiscussFrame, DiscussSession, DiscussState } from "@/entities/discuss";
import { fixtures } from "@/shared/api/msw/handlers";
import { server } from "@/shared/api/msw/server";
import { AppProviders } from "./providers";
import { createTestRouter } from "./router";

const PROJECT = "example";
const SESSION_ID = "s-1";

let seq = 0;
function frame(kind: string, data: Record<string, unknown> = {}): DiscussFrame {
  seq += 1;
  return { seq, ts: 1_785_000_000 + seq, kind, data };
}

function session(overrides: Partial<DiscussSession> = {}): DiscussSession {
  return {
    session_id: SESSION_ID,
    project: PROJECT,
    request: "add a project switcher",
    status: "awaiting",
    expects: "answer",
    started_at: 1_785_000_000,
    last_activity_at: 1_785_000_100,
    error: null,
    applied: [],
    settings: {
      note: "",
      only_ids: null,
      effort: null,
      model: null,
      session_reuse: null,
      max_question_rounds: 0,
    },
    pins: [],
    frames: [],
    ...overrides,
  };
}

function state(current: DiscussSession | null): DiscussState {
  return { ...fixtures.discussIdle, session: current };
}

/** Serves one session snapshot, and records every reply the page sends. */
function serve(snapshot: DiscussSession | null) {
  const replies: string[] = [];
  server.use(
    http.get(`*/api/projects/:project/discuss`, () => HttpResponse.json(state(snapshot))),
    http.post(`*/api/projects/:project/discuss/:id/reply`, async ({ request }) => {
      const body = (await request.json()) as { text: string };
      replies.push(body.text);
      return HttpResponse.json(session({ status: "running", expects: null }));
    }),
    http.post(`*/api/projects/:project/discuss`, async () =>
      HttpResponse.json(session({ frames: [frame("you", { text: "hello" })] })),
    ),
  );
  return replies;
}

/** The fixture project ships with no `repo_path`, which blocks the start form. */
function withCheckout() {
  server.use(
    http.get("*/api/projects", () =>
      HttpResponse.json({
        ...fixtures.projects,
        projects: fixtures.projects.projects.map((project) => ({
          ...project,
          runnable: true,
          repo_path: "/tmp/checkout",
          repo_path_source: "profile" as const,
        })),
      }),
    ),
  );
}

function renderPlanner() {
  return render(
    <AppProviders>
      <RouterProvider router={createTestRouter("/planner")} />
    </AppProviders>,
  );
}

describe("planner chat", () => {
  it("refuses to start a session against a project with no checkout", async () => {
    // The fixture project's `repo_path` is unset everywhere, which is the state
    // `example` really ships in — and the planner reads the repo, so there is
    // nothing for it to work from. Blocked before the confirmation is reachable.
    serve(null);
    renderPlanner();

    expect(await screen.findByRole("button", { name: /start session/i })).toBeDisabled();
    expect(screen.getByText(/no checkout, so the planner has nothing to read/)).toBeInTheDocument();
    // Every control on the form, not only the submit: an enabled Attach on a
    // project the planner cannot read stages files for a turn that never runs.
    expect(screen.getByRole("button", { name: /attach/i })).toBeDisabled();
    expect(screen.getByLabelText(/opening message/i)).toBeDisabled();
  });

  it("will not start on an empty message", async () => {
    // The spend confirmation this used to assert is gone — the checkbox was a
    // disclaimer between the field and the button, and `confirm` is still
    // required by, and sent to, the API. What gates the button now is the only
    // thing that ever carried information: whether there is anything to send.
    const user = userEvent.setup();
    serve(null);
    withCheckout();
    renderPlanner();

    const start = await screen.findByRole("button", { name: /start session/i });
    expect(start).toBeDisabled();

    await user.type(await screen.findByLabelText(/opening message/i), "add a switcher");
    expect(start).toBeEnabled();
  });

  it("still affirms the spend to the API, which requires it", async () => {
    const user = userEvent.setup();
    const bodies: Array<{ confirm?: boolean }> = [];
    serve(null);
    withCheckout();
    server.use(
      http.post("*/api/projects/:project/discuss", async ({ request }) => {
        bodies.push((await request.json()) as (typeof bodies)[number]);
        return HttpResponse.json(session());
      }),
    );
    renderPlanner();

    await user.type(await screen.findByLabelText(/opening message/i), "add a switcher");
    await user.click(screen.getByRole("button", { name: /start session/i }));

    expect(bodies[0]?.confirm).toBe(true);
  });

  it("sends attached files with the create request, not after it", async () => {
    // The opening call is the 385–425k-token repo sweep. An attachment that
    // arrives in a follow-up request has already missed the turn it was for, so
    // the create body is the only place it can do its job.
    const user = userEvent.setup();
    const bodies: Array<{ uploads?: Array<{ name: string; text: string }> }> = [];
    serve(null);
    withCheckout();
    server.use(
      http.post("*/api/projects/:project/discuss", async ({ request }) => {
        bodies.push((await request.json()) as (typeof bodies)[number]);
        return HttpResponse.json(session());
      }),
    );
    renderPlanner();

    await user.type(await screen.findByLabelText(/opening message/i), "fix the run timeline");
    // The picker is behind the composer's Attach toggle now: most sessions
    // attach nothing, and a permanent dropzone under the field was one of four
    // identically-weighted rows competing with the message box.
    await user.click(screen.getByRole("button", { name: /attach/i }));
    await user.upload(
      await screen.findByLabelText(/choose files/i),
      new File(["the timeline jitters on load"], "triage notes.md", { type: "text/markdown" }),
    );
    // Staged under the name the server will give it, so what is listed here is
    // what will appear in the session's pins.
    expect(await screen.findByText(/triage-notes\.md/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /start session/i }));

    expect(bodies).toHaveLength(1);
    expect(bodies[0]?.uploads).toEqual([
      { name: "triage notes.md", text: "the timeline jitters on load" },
    ]);
  });

  it("refuses an image by name, and does not send it", async () => {
    // There is no image channel in the planner prompt at all — `nodes/discuss`
    // formats text. Saying so is the honest version; the alternative is a page
    // of U+FFFD that spends context and tells the planner nothing.
    const user = userEvent.setup();
    serve(null);
    withCheckout();
    renderPlanner();

    await user.click(await screen.findByRole("button", { name: /attach/i }));
    await user.upload(
      await screen.findByLabelText(/choose files/i),
      new File(["PNG"], "screenshot.png", { type: "image/png" }),
    );

    expect(await screen.findByText(/screenshot\.png is an image/)).toBeInTheDocument();
    expect(screen.queryByText(/uploaded\/screenshot/)).not.toBeInTheDocument();
  });

  it("shows the persisted transcript when no session is live", async () => {
    serve(null);
    renderPlanner();
    expect(await screen.findByText(/rebuild the run timeline/)).toBeInTheDocument();
  });

  it("renders a question and its assumption as separate, labelled rows", async () => {
    serve(
      session({
        frames: [
          frame("you", { text: "add a project switcher" }),
          frame("assumption", { text: "the switcher reads the existing allowlist" }),
          frame("question", {
            id: "q1",
            q: "Create projects, or only select?",
            why: "changes files",
          }),
          frame("awaiting", { expects: "answer" }),
        ],
      }),
    );
    renderPlanner();

    expect(await screen.findByText("Create projects, or only select?")).toBeInTheDocument();
    expect(screen.getByText(/why it matters: changes files/)).toBeInTheDocument();
    // Once, where the planner said it. It used to be twice — inline *and* in a
    // standing Assumptions region in the session column — which is the
    // duplication that turned this page into a control panel with a chat in the
    // corner. The collected list is still reachable, in the Session sheet, for
    // the case it exists to serve: reading the whole set without scrolling.
    expect(screen.getAllByText(/reads the existing allowlist/)).toHaveLength(1);
    // The status is a chip in the header, not a panel in a column beside it.
    expect(screen.getByText("Waiting on your answer")).toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole("button", { name: "Session" }));
    expect(await screen.findByText("Assumptions")).toBeInTheDocument();
    expect(screen.getAllByText(/reads the existing allowlist/)).toHaveLength(2);
  });

  it("sends a typed answer while a question is pending", async () => {
    const user = userEvent.setup();
    const replies = serve(
      session({
        frames: [
          frame("question", { id: "q1", q: "Which store?" }),
          frame("awaiting", { expects: "answer" }),
        ],
      }),
    );
    renderPlanner();

    const box = await screen.findByPlaceholderText(/answer the planner/i);
    await user.type(box, "sqlite");
    await user.click(screen.getByRole("button", { name: /send/i }));

    expect(replies).toEqual(["sqlite"]);
  });

  it("replaces the answer box with explicit choices at the spec preview", async () => {
    const user = userEvent.setup();
    const replies = serve(
      session({
        expects: "decision",
        frames: [
          frame("specs_preview", {
            specs: [
              {
                id: "T-900",
                title: "Project switcher",
                files_write: ["src/switch.ts"],
                risk: "medium",
              },
            ],
          }),
          frame("awaiting", { expects: "decision" }),
        ],
      }),
    );
    renderPlanner();

    // No free-text box here: "looks good" typed at the preview is an edit note
    // to the loop, not an approval.
    //
    // Exactly one Apply button, and that is the assertion. There used to be two
    // — the session column's and the narrow layout's, one of them
    // `display: none` — for a single irreversible act, which jsdom (applying no
    // CSS) could only tell apart by scoping to a column that no longer exists.
    const apply = await screen.findAllByRole("button", { name: /apply to the backlog/i });
    expect(apply).toHaveLength(1);
    expect(apply[0]).toBeEnabled();
    expect(screen.queryByPlaceholderText(/answer the planner/i)).not.toBeInTheDocument();

    await user.click(apply[0] as HTMLElement);
    expect(replies).toEqual(["y"]);
  });

  it("offers a retry — not a dead end — when a planner turn fails", async () => {
    // The reported bug: a turn that timed out marked the whole session `failed`
    // and closed it, discarding a conversation the operator had already paid
    // for. It now comes back as an `awaiting` state with its own affordances.
    const user = userEvent.setup();
    const replies = serve(
      session({
        expects: "retry",
        frames: [
          frame("you", { text: "add a project switcher" }),
          frame("turn_failed", {
            text: "OrchestratorError: claude CLI produced no output for 300s",
          }),
          frame("awaiting", { expects: "retry" }),
        ],
      }),
    );
    renderPlanner();

    expect(await screen.findByText(/that planner turn failed/i)).toBeInTheDocument();
    expect(screen.getByText(/produced no output for 300s/i)).toBeInTheDocument();
    // The opening message is still on screen: the conversation was not thrown away.
    expect(screen.getByText("add a project switcher")).toBeInTheDocument();

    // An empty submit is what the loop reads as "just try again", and the text
    // form refuses to send one — so the retry has to be a button.
    await user.click(await screen.findByRole("button", { name: /try that turn again/i }));
    expect(replies).toEqual([""]);
  });

  it("lets the operator add context before retrying a failed turn", async () => {
    const user = userEvent.setup();
    const replies = serve(
      session({
        expects: "retry",
        frames: [frame("turn_failed", { text: "boom" }), frame("awaiting", { expects: "retry" })],
      }),
    );
    renderPlanner();

    await user.click(await screen.findByRole("button", { name: /retry with more context/i }));
    await user.type(
      screen.getByPlaceholderText(/anything to add before retrying/i),
      "only look at the api dir",
    );
    await user.click(screen.getByRole("button", { name: /send/i }));
    expect(replies).toEqual(["only look at the api dir"]);
  });

  it("says it is paused, not broken, when the subscription window runs out", async () => {
    // A planning session can outspend a five-hour window mid-plan. The loop
    // waits for the reset and retries itself, so the operator is not being
    // asked anything — offering them an answer box would be a lie.
    const user = userEvent.setup();
    const resetsAt = 1_785_007_200;
    const replies = serve(
      session({
        expects: "frozen",
        frames: [
          frame("you", { text: "add a project switcher" }),
          frame("limit_paused", {
            text: "claude CLI limit: usage limit reached",
            resets_at: resetsAt,
            limit_type: "five_hour",
            seconds: 3600,
          }),
          frame("awaiting", { expects: "frozen" }),
        ],
      }),
    );
    renderPlanner();

    expect(await screen.findByText(/subscription limit reached/i)).toBeInTheDocument();
    expect(screen.getByText(/resumes on its own at/i)).toBeInTheDocument();
    // No answer box and no retry button: there is nothing for them to do.
    expect(screen.queryByPlaceholderText(/answer the planner/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /try that turn again/i })).not.toBeInTheDocument();

    // The one control there is: give up rather than wait.
    await user.click(screen.getByRole("button", { name: /stop waiting/i }));
    expect(replies).toEqual(["abort"]);
  });

  it("shows what the planner is doing while a turn is in flight", async () => {
    // A turn runs into the hundreds of seconds. Without this the operator cannot
    // tell a working call from a hung one — which is what made the timeout so
    // hard to diagnose in the first place.
    serve(
      session({
        status: "running",
        expects: null,
        frames: [
          frame("thinking"),
          frame("progress", { phase: "tool", tool: "Read", target: "src/main.ts" }),
        ],
      }),
    );
    renderPlanner();

    expect(await screen.findByText("Read src/main.ts")).toBeInTheDocument();
  });

  it("shows the proposed specs as artifacts, with the blast radius on each", async () => {
    serve(
      session({
        expects: "decision",
        frames: [
          frame("specs_preview", {
            specs: [
              { id: "T-900", title: "Project switcher", files_write: ["src/switch.ts"] },
              { id: "T-901", title: "Human review pass", agent_able: false, files_write: [] },
            ],
          }),
          frame("awaiting", { expects: "decision" }),
        ],
      }),
    );
    renderPlanner();

    const panel = (await screen.findByText("Proposed specs")).closest("section, div");
    expect(panel).not.toBeNull();
    expect(screen.getByText("T-900")).toBeInTheDocument();
    expect(screen.getByText("src/switch.ts")).toBeInTheDocument();
    // A human-only spec is a different decision and says so.
    expect(screen.getByText("human-only")).toBeInTheDocument();
    // Nothing is written until the operator says so.
    expect(screen.getAllByText(/Nothing has been written yet/).length).toBeGreaterThan(0);
  });

  it("warns when an agent task has no write allowlist", async () => {
    serve(
      session({
        expects: "decision",
        frames: [
          frame("specs_preview", { specs: [{ id: "T-902", title: "Vague", files_write: [] }] }),
          frame("awaiting", { expects: "decision" }),
        ],
      }),
    );
    renderPlanner();
    // `files_write` IS the worker's write allowlist; empty means it can never
    // go green, and catching that before approval is the point of the preview.
    expect(await screen.findByText(/no write allowlist/i)).toBeInTheDocument();
  });

  it("disables the composer while the planner is mid-call", async () => {
    serve(session({ status: "running", expects: null, frames: [frame("thinking")] }));
    renderPlanner();
    expect(await screen.findByText(/The planner is working/)).toBeInTheDocument();
    expect(screen.getByText("Planner is working")).toBeInTheDocument();
  });

  it("reports an applied session as written, with the specs it wrote", async () => {
    serve(
      session({
        status: "done",
        expects: null,
        applied: [{ id: "T-900", title: "Project switcher" }],
        frames: [
          frame("specs_preview", { specs: [{ id: "T-900", title: "Project switcher" }] }),
          frame("applied", { count: 1 }),
          frame("closed", { status: "done" }),
        ],
      }),
    );
    renderPlanner();

    expect(await screen.findByText("Applied specs")).toBeInTheDocument();
    expect(screen.getByText(/Written to the backlog/)).toBeInTheDocument();
    // The transcript's own row is the third statement of the same fact, and it
    // is the one in reading order. There is no fourth: the status chip that
    // used to say "Applied 1 spec" beside all of them went with the rest of the
    // ended session's furniture.
    expect(screen.getByText(/Applied 1 spec\(s\) to the backlog/)).toBeInTheDocument();
    // And no fourth: there is no session column on this page any more, applied
    // or otherwise. What the session produced is in the conversation that
    // produced it.
    expect(screen.queryByRole("complementary", { name: /session/i })).not.toBeInTheDocument();
    // Nothing to decide on a session that already wrote — the action zone is
    // the way into the next conversation, not a second chance at this one.
    expect(screen.queryByRole("button", { name: /apply to the backlog/i })).not.toBeInTheDocument();
  });

  it("puts nothing beside a finished session that has nothing to show", async () => {
    // The knobs outweighing the conversation, which is the defect this page
    // keeps regressing into. An aborted session with no proposal and no
    // attachments used to draw a 22rem column holding a status panel that
    // restated the transcript's closing row, an attachments list reading
    // "none", and a full settings grid rendered disabled — six controls
    // explaining how they would have steered a loop that has stopped.
    serve(session({ status: "aborted", expects: null, frames: [frame("aborted", {})] }));
    withCheckout();
    renderPlanner();

    const user = userEvent.setup();
    expect(await screen.findByText(/Closed — nothing was written/)).toBeInTheDocument();
    expect(screen.queryByRole("complementary", { name: /session/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/steer/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/nothing was attached to this session/i)).not.toBeInTheDocument();

    // What is left is the conversation and somewhere to write, and exactly one
    // picker — the new session's. A second "Choose files" next to a live one is
    // worse than none.
    expect(screen.queryByLabelText(/choose files/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /attach/i }));
    expect(screen.getAllByLabelText(/choose files/i)).toHaveLength(1);
    expect(screen.getByLabelText(/choose files/i)).toBeEnabled();
  });

  it("keeps what was attached to a finished session, without the dead knobs", async () => {
    // Attachments are the one part of a session's setup that is still worth
    // reading once it has ended: they are what that conversation was given.
    // The settings are not — they only ever applied to the next turn.
    const user = userEvent.setup();
    serve(
      session({
        status: "aborted",
        expects: null,
        pins: [{ path: "uploaded/spec.md", bytes: 120, truncated: false }],
        frames: [frame("aborted", {})],
      }),
    );
    withCheckout();
    renderPlanner();

    // Setup lives in a sheet now, not in the session column — opening it used
    // to collapse the proposal it was sitting under.
    await user.click(await screen.findByRole("button", { name: "Session" }));

    expect(await screen.findByText("uploaded/spec.md")).toBeInTheDocument();
    expect(screen.getByText(/this session has ended/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/steer/i)).not.toBeInTheDocument();
  });

  it("does not compete for the session column's height with the proposal", async () => {
    // The defect this replaced: setup was a `<details>` at the foot of a
    // fixed-height column whose specs panel took the slack, so unfolding it
    // squeezed the proposal — and the approve button attached to it — to a
    // header and a footer with nothing between them. Nothing on the column's
    // critical path may be reachable only by taking room from the proposal, so
    // the controls are not in the column at all until asked for.
    const user = userEvent.setup();
    serve(session());
    withCheckout();
    renderPlanner();

    expect(await screen.findByRole("button", { name: "Session" })).toBeInTheDocument();
    expect(screen.queryByLabelText(/steer/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Session" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText(/steer/i)).toBeInTheDocument();
  });

  it("says what a new session will run as, on both sides of the field", async () => {
    // The model and the checkout, not a sentence about them. This row used to
    // left-pack five values under a 38rem composer and, on an ended session,
    // carry a paragraph explaining that the transcript is kept — the answer to
    // a question nobody asks twice, in the one place the eye lands last.
    serve(session({ status: "aborted", expects: null, frames: [frame("aborted", {})] }));
    withCheckout();
    renderPlanner();

    expect(await screen.findByText(/start a new session/i)).toBeInTheDocument();
    expect(screen.queryByText(/conversation above goes with it/i)).not.toBeInTheDocument();
    expect(screen.getByText("reads")).toBeInTheDocument();
    expect(screen.getByText(/effort$/)).toBeInTheDocument();
  });

  it("still offers a conversation after a session ends — the page is never read-only", async () => {
    // The regression this file exists to prevent. `GET …/discuss` keeps the last
    // finished session so the result is not blanked at the moment it lands, and
    // the page used to read that as "show a report instead of a chat": no
    // composer, no start form, no way back to a conversation without restarting
    // the API. Every terminal status has to leave something to type into.
    for (const status of ["aborted", "done", "failed"] as const) {
      serve(session({ status, expects: null, frames: [frame("you", { text: "the ask" })] }));
      withCheckout();
      const view = render(
        <AppProviders>
          <RouterProvider router={createTestRouter("/planner")} />
        </AppProviders>,
      );

      // The ended conversation is still readable...
      expect(await view.findByText("the ask")).toBeInTheDocument();
      // ...and there is somewhere to say the next thing.
      expect(await view.findByLabelText(/opening message/i)).toBeEnabled();
      expect(view.getByRole("button", { name: /start session/i })).toBeInTheDocument();
      expect(view.getByText(/start a new session/i)).toBeInTheDocument();
      view.unmount();
    }
  });

  it("opens a new session from a page that already shows a finished one", async () => {
    // Not merely rendered: the start path has to actually work while the old
    // session is still the one `GET …/discuss` reports.
    const user = userEvent.setup();
    const requests: Array<{ request: string }> = [];
    serve(session({ status: "aborted", expects: null, frames: [frame("aborted", {})] }));
    withCheckout();
    server.use(
      http.post("*/api/projects/:project/discuss", async ({ request }) => {
        requests.push((await request.json()) as (typeof requests)[number]);
        return HttpResponse.json(session({ session_id: "s-2" }));
      }),
    );
    renderPlanner();

    await user.type(await screen.findByLabelText(/opening message/i), "next thing");
    await user.click(screen.getByRole("button", { name: /start session/i }));

    expect(requests).toEqual([expect.objectContaining({ request: "next thing" })]);
  });

  it("puts the proposed specs in the conversation, above the buttons that decide them", async () => {
    // The plan is the thing the conversation exists to produce, so it is a row
    // in the conversation — where the planner produced it — and not a panel in
    // a column beside one. The log used to be filtered so that `specs_preview`
    // rendered nowhere in it at all: the planner fell silent at the exact turn
    // it answered the question it was asked.
    serve(
      session({
        expects: "decision",
        frames: [
          frame("you", { text: "add a project switcher" }),
          frame("specs_preview", { specs: [{ id: "T-900", title: "Project switcher" }] }),
          frame("awaiting", { expects: "decision" }),
        ],
      }),
    );
    renderPlanner();

    const specs = await screen.findByText("Proposed specs");
    expect(within(screen.getByRole("log")).getByText("T-900")).toBeInTheDocument();

    // And the decision is after it in reading order — pinned in the action
    // zone, so that a proposal of thirty specs cannot push its own approve
    // button off the bottom of anything.
    const apply = screen.getByRole("button", { name: /apply to the backlog/i });
    expect(specs.compareDocumentPosition(apply) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("keeps only the newest proposal in full, marking the ones a revision replaced", async () => {
    // A revise round replaces the plan wholesale. Re-drawing every superseded
    // list in the scrollback would bury the live one under its own history.
    serve(
      session({
        expects: "decision",
        frames: [
          frame("specs_preview", {
            specs: [
              { id: "T-800", title: "First pass" },
              { id: "T-801", title: "Second" },
            ],
          }),
          frame("you", { text: "split T-800" }),
          frame("specs_preview", { specs: [{ id: "T-900", title: "Project switcher" }] }),
          frame("awaiting", { expects: "decision" }),
        ],
      }),
    );
    renderPlanner();

    expect(await screen.findByText("T-900")).toBeInTheDocument();
    expect(screen.queryByText("T-800")).not.toBeInTheDocument();
    expect(
      screen.getByText(/Proposed 2 specs — replaced by the revision below/),
    ).toBeInTheDocument();
  });

  it("offers every configured effort and model the server reported", async () => {
    const user = userEvent.setup();
    serve(session());
    renderPlanner();

    await user.click(await screen.findByRole("button", { name: "Session" }));

    const effort = (await screen.findByLabelText(/reasoning effort/i)) as HTMLSelectElement;
    const values = [...effort.options].map((option) => option.value);
    expect(values).toEqual(["", "low", "medium", "high", "xhigh", "max"]);
    // "unset" is distinct from "set to the same value the config has": only one
    // of them follows the config when it changes.
    expect(effort.value).toBe("");
  });
});

describe("planner chat blocking", () => {
  it("explains that a running job holds the write slot", async () => {
    server.use(
      http.get("*/api/projects", () =>
        HttpResponse.json({
          ...fixtures.projects,
          projects: fixtures.projects.projects.map((project) => ({
            ...project,
            runnable: true,
            repo_path: "/tmp/checkout",
            repo_path_source: "profile" as const,
          })),
        }),
      ),
      http.get(`*/api/projects/:project/discuss`, () =>
        HttpResponse.json({ ...state(null), blocked_by_job: "run" }),
      ),
    );
    renderPlanner();

    expect(await screen.findByText(/writes to the same store/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /start session/i })).toBeDisabled();
  });
});

// The page opens an EventSource for a live session; jsdom's stub never emits, so
// nothing here depends on a frame arriving over the wire — the snapshots above
// stand in for what the stream would have appended.
vi.mock("@/entities/discuss/api/discuss-stream", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/entities/discuss/api/discuss-stream")>()),
  openDiscussStream: () => () => {},
}));
