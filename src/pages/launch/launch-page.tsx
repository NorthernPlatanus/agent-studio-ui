/**
 * Launch — the one screen that can spend money and mutate git.
 *
 * Structured as the reference's Configuration → Add-ons → Checkout column
 * (`DEVDOCS/DESIGN.md` §3.7), because a spending action should read as a
 * sequence you walk down rather than a dialog you dismiss:
 *
 *   1. **Selection** — which tasks, or none to let the scheduler decide.
 *   2. **Preview** — the wave plan from `…/waves`. Zero tokens, zero git, so it
 *      renders unprompted and is always on screen above the commit step.
 *   3. **Commit** — start / plan / resume, each confirm-gated by the server.
 *
 * Every mutation here maps to a `python -m orchestrator …` subprocess; the CLI
 * stays the single execution path, so nothing the panel does can diverge from
 * what a terminal run would do.
 */

import { RotateCcwIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { isJobLive } from "@/entities/job";
import { useJobs } from "@/entities/job/api";
import { useSummary, useWaves } from "@/entities/project/api";
import { TaskStatusBadge } from "@/entities/task";
import { useTasks } from "@/entities/task/api";
import { ImportBacklog } from "@/features/import-backlog";
import { PlanTasks } from "@/features/plan-tasks";
import { useActiveProject } from "@/features/project-switch";
import { ReconcileRuns } from "@/features/reconcile-runs";
import { ResumeRun } from "@/features/resume-run";
import { StartRun } from "@/features/start-run";
import { ApiError } from "@/shared/api/client";
import { formatInteger } from "@/shared/lib/format";
import { Banner } from "@/shared/ui/banner";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Panel, PanelBody, PanelHeader } from "@/shared/ui/panel";
import { EmptyState, Region } from "@/shared/ui/region";
import { Screen } from "@/shared/ui/screen";
import { Skeleton } from "@/shared/ui/skeleton";
import { WavePlan } from "@/widgets/wave-plan";

/**
 * The one status a run can actually dispatch.
 *
 * This list used to include `needs_human` and `failed`, which reads like the
 * retry affordance an operator wants — and does nothing. `--tasks` narrows the
 * candidate pool by id and then hands it to the same `next_batch`, which
 * requires `status == "ready"` (`engine/scheduler.py`), so a run started with a
 * failed task selected finishes immediately having touched nothing and reports
 * success. Nothing in the orchestrator moves a task back to `ready` either —
 * `runner.py`'s only such write is the `running → ready` recovery on resume — so
 * the panel cannot honestly offer the retry yet. They are listed below as
 * blocked, with the reason, rather than as checkboxes that lie.
 */
const DISPATCHABLE = new Set(["ready"]);

/** Statuses that look retryable but need a status reset the panel cannot do. */
const BLOCKED = new Set(["needs_human", "failed"]);

function StepHeading({ index, title, hint }: { index: number; title: string; hint?: string }) {
  return (
    <div className="flex items-baseline gap-2.5">
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full border border-border text-[11px] font-medium tabular-nums text-muted-foreground">
        {index}
      </span>
      <h2 className="text-[13px] font-medium">{title}</h2>
      {hint ? <span className="text-[12px] text-muted-foreground">{hint}</span> : null}
    </div>
  );
}

export function LaunchPage() {
  const { project, detail } = useActiveProject();
  const summary = useSummary(project);
  const waves = useWaves(project);
  const tasks = useTasks(project);
  const jobs = useJobs(project);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());

  const candidates = useMemo(
    () => (tasks.data?.tasks ?? []).filter((task) => DISPATCHABLE.has(task.status)),
    [tasks.data],
  );
  const blocked = useMemo(
    () => (tasks.data?.tasks ?? []).filter((task) => BLOCKED.has(task.status)),
    [tasks.data],
  );

  const inFlight = (jobs.data?.jobs ?? []).find(isJobLive);
  const active = summary.data?.active_run;
  const paused = active?.status === "paused";
  const stalled = active?.stale === true;
  const needsPlan = summary.data?.queue_stats.needs_plan ?? 0;
  const selectedIds = [...selected];

  // Which of the picked tasks no wave contains — a `ready` task whose deps are
  // not done is filtered out by `next_batch` before it reaches a batch, and the
  // preview below would otherwise just say "nothing is schedulable" without
  // connecting that to the boxes the operator just ticked.
  const schedulable = new Set(
    (waves.data?.waves ?? []).flatMap((wave) => wave.tasks.map((task) => task.id)),
  );
  const unschedulable = selectedIds.filter((id) => !schedulable.has(id));

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // A project with no store has nothing to launch — but it does have the one
  // free action that creates one, so the empty state points at it.
  if (summary.error instanceof ApiError && summary.error.status === 409) {
    return (
      <Screen rhythm="tight">
        <Banner tone="info">
          <span className="font-medium">{project}</span> has never run, so it has no store yet.
          Importing the backlog registers its tasks and creates one.
        </Banner>
        <ImportBacklog project={project} size="default" />
      </Screen>
    );
  }

  return (
    <Screen rhythm="steps">
      {inFlight ? (
        <Banner tone="warn">
          A <span className="font-medium">{inFlight.command}</span> job is already running for this
          project. Only one runs at a time — stop it from the activity panel, or wait.
        </Banner>
      ) : null}

      {stalled ? (
        <Banner tone="warn">
          Run <span className="font-mono text-xs">{active?.id}</span> still says{" "}
          <span className="font-mono text-xs">running</span> but has written nothing since{" "}
          {new Date((active?.last_activity_at ?? active?.started_at ?? 0) * 1000).toLocaleString()}{" "}
          — its process is gone. Until it is closed out, every screen reports this project as busy.
          <span className="mt-2 block">
            <ReconcileRuns project={project} staleCount={1} />
          </span>
        </Banner>
      ) : null}

      {paused ? (
        <Panel>
          <PanelHeader
            title="Paused run"
            meta={summary.data?.active_run?.id}
            actions={<ResumeRun project={project} />}
          />
          <PanelBody className="py-3">
            <p className="text-[13px] text-muted-foreground">
              {summary.data?.active_run?.note ??
                "This run stopped partway and can be continued from its checkpoint."}
            </p>
          </PanelBody>
        </Panel>
      ) : null}

      <section className="space-y-2.5">
        <StepHeading
          index={1}
          title="Choose tasks"
          hint="optional — leave empty and the scheduler picks the next wave"
        />
        <Panel>
          <PanelHeader
            title="Dispatchable"
            meta={`${formatInteger(candidates.length)} ready`}
            actions={
              selected.size > 0 ? (
                <Button size="xs" variant="ghost" onClick={() => setSelected(new Set())}>
                  <RotateCcwIcon aria-hidden="true" />
                  Clear {selected.size}
                </Button>
              ) : null
            }
          />
          <PanelBody flush>
            {tasks.isPending ? (
              <Skeleton className="m-5 h-24" />
            ) : candidates.length === 0 ? (
              <div className="p-5">
                <EmptyState>
                  No task is dispatchable. Plan the backlog first, or resolve what is blocking.
                </EmptyState>
              </div>
            ) : (
              <ul className="max-h-72 divide-y divide-border/50 overflow-y-auto">
                {candidates.map((task) => (
                  <li key={task.id}>
                    <label
                      htmlFor={`pick-${task.id}`}
                      className="flex cursor-pointer items-center gap-2.5 px-5 py-1.5 text-[13px] hover:bg-foreground/[0.03]"
                    >
                      <Checkbox
                        id={`pick-${task.id}`}
                        checked={selected.has(task.id)}
                        onCheckedChange={() => toggle(task.id)}
                      />
                      <span className="w-16 shrink-0 font-mono text-xs text-muted-foreground">
                        {task.id}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{task.title}</span>
                      <TaskStatusBadge status={task.status} />
                    </label>
                  </li>
                ))}
              </ul>
            )}

            {/*
              Named, not hidden. These are the tasks an operator comes here to
              retry, and leaving them out of the screen entirely is its own kind
              of lie — but they cannot be dispatched until something moves them
              back to `ready`, and no CLI command or API endpoint does that yet.
            */}
            {blocked.length > 0 ? (
              <div className="border-t border-border/50 px-5 py-3">
                <p className="text-[12px] text-muted-foreground">
                  {formatInteger(blocked.length)} task
                  {blocked.length === 1 ? " is" : "s are"} needs-human or failed.{" "}
                  <span className="text-foreground/70">
                    The scheduler only ever picks up <span className="font-mono">ready</span> tasks,
                    so naming one in a run would do nothing — they need a status reset first, which
                    nothing outside the store can do yet.
                  </span>
                </p>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {blocked.map((task) => (
                    <li key={task.id}>
                      <Link
                        to={`/tasks/${encodeURIComponent(task.id)}`}
                        className="inline-flex items-center gap-1.5 rounded border border-border px-1.5 py-0.5 text-[11px] hover:bg-foreground/[0.04]"
                        title={task.title}
                      >
                        <span className="font-mono">{task.id}</span>
                        <TaskStatusBadge status={task.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </PanelBody>
        </Panel>
      </section>

      <section className="space-y-2.5">
        <StepHeading
          index={2}
          title="Preview the schedule"
          hint="computed locally — spends nothing"
        />
        {waves.isPending ? (
          <Skeleton className="h-32 w-full" />
        ) : waves.error ? (
          <Banner tone="bad">Could not compute the schedule preview.</Banner>
        ) : (
          <>
            {/* The preview filters to the selection; when a picked task is in no
                wave, say which and why rather than showing an empty plan. */}
            {unschedulable.length > 0 ? (
              <Banner tone="warn">
                <span className="font-medium">Selected but not schedulable:</span>{" "}
                {unschedulable.join(", ")} — a task reaches a wave only when it is{" "}
                <span className="font-mono text-xs">ready</span> and every dependency is done.
                Starting the run now would skip {unschedulable.length === 1 ? "it" : "them"}.
              </Banner>
            ) : null}
            <WavePlan waves={waves.data} selected={selected} />
          </>
        )}
      </section>

      <section className="space-y-2.5">
        <StepHeading index={3} title="Commit" hint="spends subscription quota" />
        <StartRun
          project={project}
          detail={detail}
          selected={selectedIds}
          taskCount={summary.data?.queue_stats.ready ?? 0}
        />
      </section>

      {/*
        Outside the 1-2-3 sequence on purpose. Planning operates on `needs_plan`
        tasks, which is a disjoint set from the `ready` ones step 1 offers — so a
        fourth card in the same visual rhythm reads as "step 4 of this flow" while
        sharing none of its inputs. Its own region, with its own scope stated.

        And `selected` is NOT threaded in, for the same reason the region exists.
        Step 1 now offers only `ready` tasks, so anything ticked there is by
        definition already planned; passing it here made "Plan" flip to "Plan the
        selected tasks" and spawn `plan --tasks <a ready task>`, which is a full
        ~400k-token planner call that re-plans work that has a spec and upserts
        over it (`nodes/planner.persist_specs`). Planning is scoped by status, so
        it takes the count and nothing else.
      */}
      <Region title="Planning" meta="a different set of tasks — the unplanned ones">
        <PlanTasks project={project} needsPlanCount={needsPlan} />
      </Region>

      <Region title="Maintenance">
        <Panel>
          <PanelBody className="flex flex-wrap items-center gap-x-3 gap-y-4">
            <ImportBacklog project={project} />
            <span className="min-w-48 flex-1 text-[12px] text-muted-foreground">
              Re-reads the backlog markdown and registers any new stubs. Free — no LLM call.
            </span>
            <ReconcileRuns project={project} />
            <span className="min-w-48 flex-1 text-[12px] text-muted-foreground">
              Closes out runs whose process died without writing a terminal status, so they stop
              being reported as active. Free — no LLM call.
            </span>
          </PanelBody>
        </Panel>
      </Region>
    </Screen>
  );
}
