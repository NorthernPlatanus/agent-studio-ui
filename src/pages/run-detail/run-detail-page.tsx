/**
 * One run: what it spent, what it touched, and what happened, in that order.
 *
 * The timeline is grouped by task rather than left as a flat log, because the
 * question asked of a finished run is almost always "what happened to T-120",
 * not "what happened at 14:32".
 */

import { Link, useParams } from "react-router";
import { EventRow, groupEventsByTask } from "@/entities/event";
import { isResumable, RunStatusBadge } from "@/entities/run";
import { useRun } from "@/entities/run/api";
import { useActiveProject } from "@/features/project-switch/use-active-project";
import { ApiError } from "@/shared/api/client";
import { formatInteger, formatTimestamp, formatUsd } from "@/shared/lib/format";
import { Banner } from "@/shared/ui/banner";
import { Metric, MetricRow } from "@/shared/ui/metric";
import { Panel, PanelBody, PanelHeader } from "@/shared/ui/panel";
import { EmptyState, Region } from "@/shared/ui/region";
import { Skeleton } from "@/shared/ui/skeleton";
import { Soon } from "@/shared/ui/soon";
import { TokenPanel } from "@/widgets/token-panel";

export function RunDetailPage() {
  const { runId } = useParams();
  const { project } = useActiveProject();
  const { data, isPending, error } = useRun(project, runId);

  if (error instanceof ApiError && error.status === 404) {
    return (
      <div className="pt-2">
        <Banner tone="bad">
          No run <span className="font-mono">{runId}</span> in this project.{" "}
          <Link to="/runs" className="underline underline-offset-2">
            Back to runs
          </Link>
        </Banner>
      </div>
    );
  }
  if (error) {
    return (
      <div className="pt-2">
        <Banner tone="bad">Could not read this run.</Banner>
      </div>
    );
  }
  if (isPending) {
    return (
      <div className="space-y-3 pt-2">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const groups = groupEventsByTask(data.events);

  return (
    <div className="space-y-4 pt-1">
      {data.note ? (
        <Banner tone={isResumable(data) ? "warn" : "info"}>
          {data.note}
          {isResumable(data) ? (
            <span className="ml-2">
              <Soon label="Resume soon" title="Resume lands with the job-control feature" />
            </span>
          ) : null}
        </Banner>
      ) : null}

      <MetricRow>
        <Metric label="Status" value={<RunStatusBadge status={data.status} />} />
        <Metric label="Started" value={formatTimestamp(data.started_at)} />
        <Metric label="Cash" value={formatUsd(data.cost_usd)} hint="this run" />
        <Metric
          label="Tasks touched"
          value={formatInteger(data.task_ids.length)}
          hint={`${formatInteger(data.events.length)} events`}
        />
      </MetricRow>

      <Panel>
        <PanelHeader title="Tokens" />
        <PanelBody>
          <TokenPanel tokens={data.tokens} />
        </PanelBody>
      </Panel>

      <Region title="Timeline" meta={`${formatInteger(data.events.length)} events`}>
        {groups.length === 0 ? (
          <EmptyState>This run recorded no events.</EmptyState>
        ) : (
          <div className="space-y-3">
            {groups.map((group) => (
              <Panel key={group.taskId ?? "run"}>
                <PanelHeader
                  title={
                    group.taskId === null ? (
                      "Run-level"
                    ) : (
                      <Link
                        to={`/tasks/${encodeURIComponent(group.taskId)}`}
                        className="font-mono text-[13px] underline-offset-2 hover:underline"
                      >
                        {group.taskId}
                      </Link>
                    )
                  }
                  meta={`${group.events.length} event${group.events.length === 1 ? "" : "s"}`}
                />
                <PanelBody className="py-1">
                  <ul>
                    {group.events.map((event) => (
                      <EventRow key={event.rowid} event={event} showTask={false} />
                    ))}
                  </ul>
                </PanelBody>
              </Panel>
            ))}
          </div>
        )}
      </Region>
    </div>
  );
}
