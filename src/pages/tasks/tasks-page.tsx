/**
 * The task table.
 *
 * A Tier-3 region (`DEVDOCS/DESIGN.md` §3.4): the table sits on the page, not in
 * a rounded card. Rows are dense (`h-9`, 13px) because there are a lot of them —
 * the roominess in this design lives at the panel level, not inside data.
 *
 * The row count comes from the rendered rows, never from `Tasks.total`: `total`
 * and `queue_stats` describe the **server**-filtered set, and four of the seven
 * filters are narrowed client-side.
 */

import { Link } from "react-router";
import {
  facetValues,
  filterTasks,
  hasClientOnlyNarrowing,
  TaskFlags,
  TaskStatusBadge,
  toTaskQueryParams,
} from "@/entities/task";
import { useTasks } from "@/entities/task/api";
import { useActiveProject } from "@/features/project-switch/use-active-project";
import { TaskFilterBar } from "@/features/task-filters";
import { ApiError } from "@/shared/api/client";
import { formatInteger, formatUsd, textOrDash } from "@/shared/lib/format";
import { useUiStore } from "@/shared/store/ui-store";
import { Banner } from "@/shared/ui/banner";
import { EmptyState, Region } from "@/shared/ui/region";
import { Skeleton } from "@/shared/ui/skeleton";
import { Chip } from "@/shared/ui/status-dot";

const TH =
  "h-8 px-3 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground";
const TD = "px-3 py-0 align-middle";

export function TasksPage() {
  const { project } = useActiveProject();
  const filters = useUiStore((state) => state.taskFilters);
  const { data, isPending, error } = useTasks(project, toTaskQueryParams(filters));

  const serverTasks = data?.tasks ?? [];
  const rows = filterTasks(serverTasks, filters);
  const narrowed = hasClientOnlyNarrowing(filters);

  return (
    <div className="space-y-3 pt-1">
      <TaskFilterBar
        milestones={facetValues(serverTasks, (task) => task.milestone)}
        domains={facetValues(serverTasks, (task) => task.domain)}
      />

      {error instanceof ApiError && error.status === 409 ? (
        <Banner tone="info">This project has no store yet — nothing to list.</Banner>
      ) : error ? (
        <Banner tone="bad">Could not read the task list.</Banner>
      ) : null}

      <Region
        title="Tasks"
        meta={
          isPending
            ? undefined
            : narrowed
              ? `${formatInteger(rows.length)} of ${formatInteger(data?.total ?? 0)} matching`
              : `${formatInteger(rows.length)}`
        }
      >
        {isPending ? (
          <div className="space-y-1.5">
            {[0, 1, 2, 3, 4, 5].map((row) => (
              <Skeleton key={row} className="h-9 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState>No task matches these filters.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-border">
                  <th className={TH}>Status</th>
                  <th className={TH}>Task</th>
                  <th className={TH}>Attributes</th>
                  <th className={`${TH} text-right`}>Retries</th>
                  <th className={`${TH} text-right`}>Cost</th>
                  <th className={TH}>Milestone</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((task) => (
                  <tr
                    key={task.id}
                    className="h-9 border-b border-border/50 transition-colors hover:bg-foreground/[0.03]"
                  >
                    <td className={TD}>
                      <TaskStatusBadge status={task.status} />
                    </td>
                    <td className={`${TD} max-w-0`}>
                      <Link
                        to={`/tasks/${encodeURIComponent(task.id)}`}
                        className="flex min-w-0 items-baseline gap-2 underline-offset-2 hover:underline"
                      >
                        <span className="shrink-0 font-mono text-xs text-muted-foreground">
                          {task.id}
                        </span>
                        <span className="truncate">{task.title}</span>
                      </Link>
                    </td>
                    <td className={TD}>
                      <span className="flex items-center gap-1">
                        <TaskFlags task={task} showDomain />
                        {(task.deps ?? []).length > 0 ? (
                          <Chip title={`Depends on ${(task.deps ?? []).join(", ")}`}>
                            {(task.deps ?? []).length} dep
                            {(task.deps ?? []).length === 1 ? "" : "s"}
                          </Chip>
                        ) : null}
                      </span>
                    </td>
                    <td className={`${TD} text-right tabular-nums`}>
                      {task.retries === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        task.retries
                      )}
                    </td>
                    <td className={`${TD} text-right tabular-nums`}>
                      {task.cost_usd === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        formatUsd(task.cost_usd)
                      )}
                    </td>
                    <td className={`${TD} text-muted-foreground`}>{textOrDash(task.milestone)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Region>
    </div>
  );
}
