/**
 * One task: the planner's spec, what it cost, its candidates, its history.
 *
 * `cash_spend_usd` is the figure shown, not `cost_usd`: the latter is
 * accumulated at write time and can lag a re-run (CONTRACT §3).
 */

import { Link, useParams } from "react-router";
import { EventRow, newestFirst } from "@/entities/event";
import { TaskFlags, TaskStatusBadge } from "@/entities/task";
import { useTask } from "@/entities/task/api";
import { useActiveProject } from "@/features/project-switch";
import { ApiError } from "@/shared/api/client";
import { formatInteger, formatTimestamp, formatUsd, textOrDash } from "@/shared/lib/format";
import { Banner } from "@/shared/ui/banner";
import { Field, Metric, MetricRow } from "@/shared/ui/metric";
import { Panel, PanelBody, PanelHeader } from "@/shared/ui/panel";
import { EmptyState, Region } from "@/shared/ui/region";
import { Screen } from "@/shared/ui/screen";
import { Skeleton } from "@/shared/ui/skeleton";
import { Chip } from "@/shared/ui/status-dot";
import { CandidateBoard } from "@/widgets/candidate-board";

function FileList({ paths }: { paths: readonly string[] | undefined }) {
  if (!paths || paths.length === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <ul className="space-y-0.5">
      {paths.map((path) => (
        <li key={path} className="truncate font-mono text-xs" title={path}>
          {path}
        </li>
      ))}
    </ul>
  );
}

function TaskLinks({ ids }: { ids: readonly string[] | undefined }) {
  if (!ids || ids.length === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {ids.map((id) => (
        <Link key={id} to={`/tasks/${encodeURIComponent(id)}`}>
          <Chip className="hover:border-foreground/30">{id}</Chip>
        </Link>
      ))}
    </span>
  );
}

export function TaskDetailPage() {
  const { taskId } = useParams();
  const { project } = useActiveProject();
  const { data, isPending, error } = useTask(project, taskId);

  if (error instanceof ApiError && error.status === 404) {
    return (
      <Screen>
        <Banner tone="bad">
          No task <span className="font-mono">{taskId}</span> in this project.{" "}
          <Link to="/tasks" className="underline underline-offset-2">
            Back to tasks
          </Link>
        </Banner>
      </Screen>
    );
  }
  if (error) {
    return (
      <Screen>
        <Banner tone="bad">Could not read this task.</Banner>
      </Screen>
    );
  }
  if (isPending) {
    return (
      <Screen>
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </Screen>
    );
  }

  const events = newestFirst(data.events ?? []);

  return (
    <Screen>
      {/* The attribute chip row, directly under the location chip that names the
          task — the reference's feature strip (DESIGN §3.6). */}
      <div className="flex flex-wrap items-center gap-1.5">
        <TaskStatusBadge status={data.status} />
        <TaskFlags task={data} showDomain />
        {data.n_candidates ? (
          <Chip title="Candidates per attempt">n={data.n_candidates}</Chip>
        ) : null}
      </div>

      <MetricRow>
        <Metric label="Cash spend" value={formatUsd(data.cash_spend_usd)} hint="lifetime" />
        <Metric
          label="Retries"
          value={formatInteger(data.retries)}
          hint={data.retries > 0 ? "escalation ladder" : "clean"}
        />
        <Metric label="Milestone" value={textOrDash(data.milestone)} />
        <Metric label="Updated" value={formatTimestamp(data.updated_at)} />
      </MetricRow>

      <Panel>
        <PanelHeader title="Spec" meta="as the planner wrote it" />
        <PanelBody>
          <dl className="divide-y divide-border/50">
            <Field label="Depends on">
              <TaskLinks ids={data.deps} />
            </Field>
            {data.parent_id ? (
              <Field label="Parent">
                <TaskLinks ids={[data.parent_id]} />
              </Field>
            ) : null}
            {data.children && data.children.length > 0 ? (
              <Field label="Children">
                <TaskLinks ids={data.children} />
              </Field>
            ) : null}
            <Field label="Writes">
              <FileList paths={data.files_write} />
            </Field>
            <Field label="Reads">
              <FileList paths={data.files_read} />
            </Field>
            <Field label="Acceptance">
              {data.acceptance && data.acceptance.length > 0 ? (
                <ul className="list-inside list-disc space-y-0.5">
                  {data.acceptance.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </Field>
          </dl>
        </PanelBody>
      </Panel>

      <Region title="Candidates">
        <CandidateBoard project={project} taskId={taskId} />
      </Region>

      <Region title="History" meta={`${formatInteger(events.length)} events`}>
        {events.length === 0 ? (
          <EmptyState>Nothing has happened to this task yet.</EmptyState>
        ) : (
          <Panel>
            <PanelBody className="py-1">
              <ul>
                {events.map((event) => (
                  <EventRow key={event.rowid} event={event} showTask={false} />
                ))}
              </ul>
            </PanelBody>
          </Panel>
        )}
      </Region>
    </Screen>
  );
}
