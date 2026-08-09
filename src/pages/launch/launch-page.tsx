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
import { isJobLive } from "@/entities/job";
import { useJobs } from "@/entities/job/api";
import { useSummary, useWaves } from "@/entities/project/api";
import { TaskStatusBadge } from "@/entities/task";
import { useTasks } from "@/entities/task/api";
import { ImportBacklog } from "@/features/import-backlog";
import { PlanTasks } from "@/features/plan-tasks";
import { useActiveProject } from "@/features/project-switch";
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

/** Statuses a run can actually dispatch. */
const DISPATCHABLE = new Set(["ready", "needs_human", "failed"]);

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

  const inFlight = (jobs.data?.jobs ?? []).find(isJobLive);
  const paused = summary.data?.active_run?.status === "paused";
  const needsPlan = summary.data?.queue_stats.needs_plan ?? 0;
  const selectedIds = [...selected];

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
            meta={`${formatInteger(candidates.length)} ready, needs-human or failed`}
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
          <WavePlan waves={waves.data} selected={selected} />
        )}
      </section>

      <section className="space-y-2.5">
        <StepHeading index={3} title="Commit" hint="everything below spends quota" />
        <StartRun
          project={project}
          detail={detail}
          selected={selectedIds}
          taskCount={summary.data?.queue_stats.ready ?? 0}
        />
        <PlanTasks project={project} needsPlanCount={needsPlan} selected={selectedIds} />
      </section>

      <Region title="Maintenance">
        <Panel>
          <PanelBody className="flex flex-wrap items-center gap-3">
            <ImportBacklog project={project} />
            <span className="text-[12px] text-muted-foreground">
              Re-reads the backlog markdown and registers any new stubs. Free — no LLM call.
            </span>
          </PanelBody>
        </Panel>
      </Region>
    </Screen>
  );
}
