/**
 * The dashboard.
 *
 * No `<h1>` and no explanatory subtitle — the top bar's location chip says where
 * you are (`DEVDOCS/DESIGN.md` §3.3). The screen opens with the active run,
 * because that is the question the operator came to ask.
 */

import { AlertTriangleIcon } from "lucide-react";
import { Link } from "react-router";
import { useSummary } from "@/entities/project/api";
import { isResumable, RunStatusBadge } from "@/entities/run";
import { useActiveProject } from "@/features/project-switch/use-active-project";
import { ApiError } from "@/shared/api/client";
import { useNow } from "@/shared/hooks";
import { formatDuration, formatInteger, formatTimestamp, formatUsd } from "@/shared/lib/format";
import { Banner } from "@/shared/ui/banner";
import { Metric, MetricRow } from "@/shared/ui/metric";
import { Panel, PanelBody, PanelHeader } from "@/shared/ui/panel";
import { EmptyState, Region } from "@/shared/ui/region";
import { Skeleton } from "@/shared/ui/skeleton";
import { Soon } from "@/shared/ui/soon";
import { QueueBoard } from "@/widgets/queue-board";
import { StagePipeline } from "@/widgets/stage-pipeline";
import { TokenPanel } from "@/widgets/token-panel";

function ActiveRunPanel({ project }: { project: string | null }) {
  const { data } = useSummary(project);
  const run = data?.active_run ?? data?.last_run ?? null;
  const isCurrent = Boolean(data?.active_run);
  const now = useNow(run?.status === "running");

  if (!run) {
    return (
      <Panel>
        <PanelHeader title="Run" />
        <PanelBody>
          <EmptyState>No run has been started for this project.</EmptyState>
        </PanelBody>
      </Panel>
    );
  }

  const elapsed = now - run.started_at;

  return (
    <Panel>
      <PanelHeader
        title={isCurrent ? "Active run" : "Last run"}
        meta={
          <Link
            to={`/runs/${encodeURIComponent(run.id)}`}
            className="font-mono underline-offset-2 hover:text-foreground hover:underline"
          >
            {run.id}
          </Link>
        }
        actions={<RunStatusBadge status={run.status} />}
      />
      <PanelBody className="space-y-4">
        {/* Tier 2: the pause reason belongs next to the run it explains, not in a
            toast that has already gone by the time anyone looks. */}
        {run.note ? (
          <Banner tone={isResumable(run) ? "warn" : "info"}>
            {run.note}
            {isResumable(run) ? (
              <span className="ml-2 inline-flex items-center gap-1.5">
                <Soon label="Resume soon" title="Resume lands with the job-control feature" />
              </span>
            ) : null}
          </Banner>
        ) : null}

        <div className="grid grid-cols-2 gap-x-8 gap-y-4 lg:grid-cols-4">
          <Metric
            label="Started"
            value={formatTimestamp(run.started_at)}
            hint={run.status === "running" ? `${formatDuration(elapsed)} elapsed` : undefined}
          />
          <Metric label="Cash" value={formatUsd(run.cost_usd)} hint="this run" />
          <Metric
            label="Wave"
            value={<span className="text-muted-foreground">—</span>}
            hint="not reported per run"
          />
          <Metric
            label="Tasks touched"
            value={<span className="text-muted-foreground">—</span>}
            hint="see run detail"
          />
        </div>

        <TokenPanel tokens={run.tokens} />
      </PanelBody>
    </Panel>
  );
}

export function DashboardPage() {
  const { project, detail } = useActiveProject();
  const { data, isPending, error } = useSummary(project);

  // 404 and 409 are different empty states and must not collapse into one
  // (CONTRACT §2): "no such project" is a switcher problem, "never run" is not a
  // problem at all.
  if (error instanceof ApiError && error.status === 409) {
    return (
      <div className="pt-2">
        <Banner tone="info">
          <strong className="font-medium">{project}</strong> has no store yet — it has never run.
          Import a backlog to create one.{" "}
          <span className="text-muted-foreground">
            {typeof error.detail === "string" ? error.detail : null}
          </span>
        </Banner>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pt-2">
        <Banner tone="bad">
          Could not read this project.{" "}
          {error instanceof ApiError && typeof error.detail === "string" ? error.detail : null}
        </Banner>
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

  const exceptions = Object.entries(data.event_counts).filter(([, count]) => count > 0);

  return (
    <div className="space-y-4 pt-1">
      <MetricRow>
        <Metric label="Tasks" value={formatInteger(data.task_count)} hint={project ?? ""} />
        <Metric
          label="Ready"
          value={formatInteger(data.queue_stats.ready ?? 0)}
          hint="eligible for the next wave"
        />
        <Metric
          label="Needs human"
          value={formatInteger(
            (data.queue_stats.needs_human ?? 0) + (data.queue_stats.human_only ?? 0),
          )}
          hint="blocked on you"
        />
        <Metric
          label="Cash spend"
          value={formatUsd(data.cash_spend_usd)}
          hint="lifetime, this project"
        />
      </MetricRow>

      {detail && detail.runnable === false ? (
        <Banner tone="warn">
          This project has no checkout configured, so runs cannot be started from the panel.
          <span className="ml-1 text-muted-foreground">{detail.runnable_detail}</span>
        </Banner>
      ) : null}

      <ActiveRunPanel project={project} />

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel>
          <PanelHeader title="Queue" meta={`${formatInteger(data.task_count)} tasks`} />
          <PanelBody>
            <QueueBoard queueStats={data.queue_stats} />
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader title="Domains" />
          <PanelBody>
            {Object.keys(data.domain_stats).length === 0 ? (
              <EmptyState>The planner has not assigned domains yet.</EmptyState>
            ) : (
              <ul className="space-y-1.5">
                {Object.entries(data.domain_stats)
                  .sort(([, a], [, b]) => b - a)
                  .map(([domain, count]) => (
                    <li key={domain}>
                      <Link
                        to={`/tasks?domain=${encodeURIComponent(domain)}`}
                        className="-mx-1 flex items-baseline gap-3 rounded px-1 py-0.5 text-[13px] hover:bg-foreground/5"
                      >
                        <span className="min-w-0 flex-1 truncate">{domain}</span>
                        <span className="shrink-0 font-medium tabular-nums">
                          {formatInteger(count)}
                        </span>
                      </Link>
                    </li>
                  ))}
              </ul>
            )}
          </PanelBody>
        </Panel>
      </div>

      <Region
        title="Pipeline"
        meta={
          exceptions.length === 0
            ? "no exceptions recorded"
            : `${exceptions.length} stage${exceptions.length === 1 ? "" : "s"} with exceptions`
        }
        actions={
          exceptions.length > 0 ? (
            <span className="flex items-center gap-1 text-[11px] text-status-warn">
              <AlertTriangleIcon className="size-3" aria-hidden="true" />
              needs attention
            </span>
          ) : null
        }
      >
        <StagePipeline eventCounts={data.event_counts} />
      </Region>
    </div>
  );
}
