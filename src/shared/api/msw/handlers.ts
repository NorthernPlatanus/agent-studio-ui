/**
 * Default MSW handlers, backed **only** by the captured fixtures in
 * `src/shared/api/__fixtures__/` (PLAN §4.5 — mocks may not be handwritten, or
 * they drift from the contract silently).
 *
 * Three behaviours are reproduced from the real API rather than stubbed, because
 * screens depend on them:
 *
 *  - **Project scoping / error codes** (CONTRACT §2): `example` is the seeded
 *    project; `demo-project` is allowlisted but has no store, so every read returns
 *    the captured 409 envelope; anything else returns the captured 404. Both are
 *    normal states the UI must render, so both are reachable in tests.
 *  - **`…/tasks` filtering** — `status`/`milestone`/`domain`/`parent_id`/`q` are
 *    applied here and `total`/`queue_stats` recomputed for the filtered set,
 *    exactly as the server documents them.
 *  - **`…/events` paging** (CONTRACT §5) — ascending by `rowid`, strictly after
 *    `since_rowid`, and an empty page returns the cursor it was given.
 *
 * Where a response is *derived* rather than captured it is derived only from
 * captured data (see `deriveTaskDetail`); nothing is invented.
 */

import { HttpResponse, http, type RequestHandler } from "msw";
import candidatesFixture from "@/shared/api/__fixtures__/candidates.json";
import error404Job from "@/shared/api/__fixtures__/error-404-job.json";
import error404Project from "@/shared/api/__fixtures__/error-404-project.json";
import error404Task from "@/shared/api/__fixtures__/error-404-task.json";
import error409NoStore from "@/shared/api/__fixtures__/error-409-no-store.json";
import eventsFixture from "@/shared/api/__fixtures__/events.json";
import healthzFixture from "@/shared/api/__fixtures__/healthz.json";
import jobsFixture from "@/shared/api/__fixtures__/jobs.json";
import metricsFixture from "@/shared/api/__fixtures__/metrics.json";
import projectsFixture from "@/shared/api/__fixtures__/projects.json";
import runDetailFixture from "@/shared/api/__fixtures__/run-detail.json";
import runDetailPausedFixture from "@/shared/api/__fixtures__/run-detail-paused.json";
import runsFixture from "@/shared/api/__fixtures__/runs.json";
import summaryFixture from "@/shared/api/__fixtures__/summary.json";
import taskDetailFixture from "@/shared/api/__fixtures__/task-detail.json";
import tasksFixture from "@/shared/api/__fixtures__/tasks.json";
import usageByDayFixture from "@/shared/api/__fixtures__/usage-by-day.json";
import usageByRoleFixture from "@/shared/api/__fixtures__/usage-by-role.json";
import wavesFixture from "@/shared/api/__fixtures__/waves.json";
import type { components } from "@/shared/api/generated";

type Schemas = components["schemas"];

/** The project the fixture store was seeded for. */
export const FIXTURE_PROJECT = "example";
/** Allowlisted, but `has_store: false` — every read is a 409. */
export const FIXTURE_PROJECT_NO_STORE = "demo-project";
export const FIXTURE_RUN_DONE = "20260701-101500-aaaaaa";
export const FIXTURE_RUN_PAUSED = "20260702-141500-bbbbbb";
/** The running task whose candidates came from a real checkpoint. */
export const FIXTURE_CHECKPOINT_TASK = "T-120";
/** The decomposed parent — the one task whose detail response was captured. */
export const FIXTURE_PARENT_TASK = "T-131";

export const fixtures = {
  healthz: healthzFixture as Schemas["Health"],
  projects: projectsFixture as Schemas["Projects"],
  summary: summaryFixture as Schemas["Summary"],
  waves: wavesFixture as Schemas["Waves"],
  tasks: tasksFixture as Schemas["Tasks"],
  taskDetail: taskDetailFixture as Schemas["TaskDetail"],
  candidates: candidatesFixture as Schemas["Candidates"],
  runs: runsFixture as Schemas["Runs"],
  runDetail: runDetailFixture as Schemas["RunDetail"],
  runDetailPaused: runDetailPausedFixture as Schemas["RunDetail"],
  usageByRole: usageByRoleFixture as Schemas["Usage"],
  usageByDay: usageByDayFixture as Schemas["Usage"],
  metrics: metricsFixture as Schemas["Metrics"],
  events: eventsFixture as Schemas["Events"],
  jobs: jobsFixture as Schemas["Jobs"],
  error404Project: error404Project as { detail: string },
  error404Task: error404Task as { detail: string },
  error404Job: error404Job as { detail: string },
  error409NoStore: error409NoStore as { detail: string },
} as const;

const notFoundProject = () => HttpResponse.json(fixtures.error404Project, { status: 404 });
const noStore = () => HttpResponse.json(fixtures.error409NoStore, { status: 409 });

/**
 * The project gate every scoped read goes through. Returns a response to send
 * back, or `null` when the project is readable.
 */
function projectGate(project: string | readonly string[] | undefined) {
  if (typeof project !== "string") return notFoundProject();
  if (project === FIXTURE_PROJECT) return null;
  if (project === FIXTURE_PROJECT_NO_STORE) return noStore();
  return notFoundProject();
}

function countByStatus(tasks: readonly Schemas["TaskListItem"][]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const task of tasks) counts[task.status] = (counts[task.status] ?? 0) + 1;
  return counts;
}

/**
 * A `TaskDetail` for a task whose detail response was not captured, assembled
 * from captured rows only: the list projection supplies the promoted fields and
 * doubles as the `spec` blob (the server's spec is a superset of exactly these
 * keys), `children` comes from `parent_id` back-references, and `events` from the
 * captured event log filtered by `task_id`.
 */
function deriveTaskDetail(row: Schemas["TaskListItem"]): Schemas["TaskDetail"] {
  return {
    ...row,
    files_read: [],
    files_write: [],
    acceptance: [],
    cash_spend_usd: row.cost_usd,
    children: fixtures.tasks.tasks.filter((t) => t.parent_id === row.id).map((t) => t.id),
    spec: { ...row } as Record<string, unknown>,
    events: fixtures.events.events.filter((event) => event.task_id === row.id),
  };
}

const API = "*/api";

export const handlers: RequestHandler[] = [
  http.get("*/healthz", () => HttpResponse.json(fixtures.healthz)),

  http.get(`${API}/projects`, () => HttpResponse.json(fixtures.projects)),

  http.get(`${API}/projects/:project/summary`, ({ params }) => {
    const gate = projectGate(params.project);
    return gate ?? HttpResponse.json(fixtures.summary);
  }),

  http.get(`${API}/projects/:project/waves`, ({ params }) => {
    const gate = projectGate(params.project);
    return gate ?? HttpResponse.json(fixtures.waves);
  }),

  http.get(`${API}/projects/:project/tasks`, ({ params, request }) => {
    const gate = projectGate(params.project);
    if (gate) return gate;

    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const milestone = url.searchParams.get("milestone");
    const domain = url.searchParams.get("domain");
    const parentId = url.searchParams.get("parent_id");
    const q = url.searchParams.get("q")?.toLowerCase();

    const rows = fixtures.tasks.tasks.filter((task) => {
      if (status && task.status !== status) return false;
      if (milestone && task.milestone !== milestone) return false;
      if (domain && task.domain !== domain) return false;
      if (parentId && task.parent_id !== parentId) return false;
      if (q) {
        const haystack = `${task.id} ${task.title}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    return HttpResponse.json({
      tasks: rows,
      total: rows.length,
      queue_stats: countByStatus(rows),
    } satisfies Schemas["Tasks"]);
  }),

  http.get(`${API}/projects/:project/tasks/:taskId`, ({ params }) => {
    const gate = projectGate(params.project);
    if (gate) return gate;

    const taskId = String(params.taskId);
    if (taskId === FIXTURE_PARENT_TASK) return HttpResponse.json(fixtures.taskDetail);

    const row = fixtures.tasks.tasks.find((task) => task.id === taskId);
    if (!row) return HttpResponse.json(fixtures.error404Task, { status: 404 });
    return HttpResponse.json(deriveTaskDetail(row));
  }),

  http.get(`${API}/projects/:project/tasks/:taskId/candidates`, ({ params }) => {
    const gate = projectGate(params.project);
    if (gate) return gate;

    const taskId = String(params.taskId);
    if (taskId === FIXTURE_CHECKPOINT_TASK) return HttpResponse.json(fixtures.candidates);
    if (!fixtures.tasks.tasks.some((task) => task.id === taskId)) {
      return HttpResponse.json(fixtures.error404Task, { status: 404 });
    }
    // Nothing ran, or the checkpoint was pruned — a real documented state.
    return HttpResponse.json({
      task_id: taskId,
      run_id: null,
      source: "none",
      candidates: [],
    } satisfies Schemas["Candidates"]);
  }),

  http.get(`${API}/projects/:project/runs`, ({ params, request }) => {
    const gate = projectGate(params.project);
    if (gate) return gate;
    const limit = Number(new URL(request.url).searchParams.get("limit") ?? 50);
    return HttpResponse.json({
      runs: fixtures.runs.runs.slice(0, Number.isFinite(limit) ? limit : 50),
    } satisfies Schemas["Runs"]);
  }),

  http.get(`${API}/projects/:project/runs/:runId`, ({ params }) => {
    const gate = projectGate(params.project);
    if (gate) return gate;
    const runId = String(params.runId);
    if (runId === FIXTURE_RUN_DONE) return HttpResponse.json(fixtures.runDetail);
    if (runId === FIXTURE_RUN_PAUSED) return HttpResponse.json(fixtures.runDetailPaused);
    return HttpResponse.json({ detail: `unknown run: '${runId}'` }, { status: 404 });
  }),

  http.get(`${API}/projects/:project/usage`, ({ params, request }) => {
    const gate = projectGate(params.project);
    if (gate) return gate;
    const groupBy = new URL(request.url).searchParams.get("group_by") ?? "role";
    if (groupBy === "role") return HttpResponse.json(fixtures.usageByRole);
    if (groupBy === "day") return HttpResponse.json(fixtures.usageByDay);
    // Only `role` and `day` were captured. Fabricating `model`/`provider` rows is
    // exactly the drift captured fixtures exist to prevent, so fail loudly: a
    // test that needs them must capture them first.
    return HttpResponse.json(
      { detail: `no captured usage fixture for group_by='${groupBy}'` },
      { status: 501 },
    );
  }),

  http.get(`${API}/projects/:project/metrics`, ({ params }) => {
    const gate = projectGate(params.project);
    return gate ?? HttpResponse.json(fixtures.metrics);
  }),

  http.get(`${API}/projects/:project/events`, ({ params, request }) => {
    const gate = projectGate(params.project);
    if (gate) return gate;

    const url = new URL(request.url);
    const rawSince = url.searchParams.get("since_rowid");
    const since = rawSince === null ? 0 : Number(rawSince);
    const kind = url.searchParams.get("kind");
    const taskId = url.searchParams.get("task_id");
    const runId = url.searchParams.get("run_id");
    const limit = Number(url.searchParams.get("limit") ?? 200);

    const order = url.searchParams.get("order") === "desc" ? "desc" : "asc";

    const matching = fixtures.events.events
      .filter((event) => event.rowid > since)
      .filter((event) => (kind ? event.kind === kind : true))
      .filter((event) => (taskId ? event.task_id === taskId : true))
      .filter((event) => (runId ? event.run_id === runId : true))
      .sort((a, b) => (order === "desc" ? b.rowid - a.rowid : a.rowid - b.rowid))
      .slice(0, Number.isFinite(limit) ? limit : 200);

    // The cursor is the HIGHEST rowid in the page in **both** orders, so a poller
    // that switches order still moves forward (CONTRACT §5).
    const highest = matching.reduce<number | null>(
      (best, event) => (best === null || event.rowid > best ? event.rowid : best),
      null,
    );
    return HttpResponse.json({
      events: matching,
      order,
      // An empty page returns the cursor it was given — never a rewind to 0.
      next_since_rowid: highest ?? since,
      max_rowid: fixtures.events.max_rowid,
    } satisfies Schemas["Events"]);
  }),

  http.get(`${API}/projects/:project/jobs`, ({ params }) => {
    const gate = projectGate(params.project);
    return gate ?? HttpResponse.json(fixtures.jobs);
  }),

  // Phase 1 stubs: the two detail routes are 404 by contract until phase 3.
  http.get(`${API}/projects/:project/jobs/:jobId`, ({ params }) => {
    const gate = projectGate(params.project);
    return gate ?? HttpResponse.json(fixtures.error404Job, { status: 404 });
  }),
  http.get(`${API}/projects/:project/jobs/:jobId/log`, ({ params }) => {
    const gate = projectGate(params.project);
    return gate ?? HttpResponse.json(fixtures.error404Job, { status: 404 });
  }),
];
