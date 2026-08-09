/**
 * The task table.
 *
 * A Tier-3 region (`DEVDOCS/DESIGN.md` §3.4): the table sits on the page, not in
 * a rounded card, and its columns are declared rather than content-derived so
 * filtering never shifts the layout under the cursor.
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
  type TaskListItem,
  TaskStatusBadge,
  toTaskQueryParams,
} from "@/entities/task";
import { useTasks } from "@/entities/task/api";
import { useActiveProject } from "@/features/project-switch";
import { TaskFilterBar } from "@/features/task-filters";
import { ApiError } from "@/shared/api/client";
import { formatInteger, formatUsd, textOrDash } from "@/shared/lib/format";
import { useUiStore } from "@/shared/store/ui-store";
import { Banner } from "@/shared/ui/banner";
import { Cell, type Column, DataTable, Row, useColumnVisible } from "@/shared/ui/data-table";
import { EmptyState, Region } from "@/shared/ui/region";
import { Screen } from "@/shared/ui/screen";
import { Skeleton } from "@/shared/ui/skeleton";
import { Chip } from "@/shared/ui/status-dot";

const STATUS: Column = { key: "status", header: "Status", width: "8.5rem" };
const TASK: Column = { key: "task", header: "Task" };
const ATTRIBUTES: Column = {
  key: "attributes",
  header: "Attributes",
  width: "20rem",
  hideBelow: "lg",
};
const RETRIES: Column = {
  key: "retries",
  header: "Retries",
  width: "5rem",
  align: "right",
  hideBelow: "sm",
};
const COST: Column = { key: "cost", header: "Cost", width: "6rem", align: "right" };
const MILESTONE: Column = { key: "milestone", header: "Milestone", width: "7rem", hideBelow: "md" };

const COLUMNS = [STATUS, TASK, ATTRIBUTES, RETRIES, COST, MILESTONE];

/**
 * Title, id, and — once the attributes column has been dropped for width — the
 * attribute chips underneath. Relocating them beats hiding them: they are the
 * fastest way to read a backlog, and a narrow window is not a reason to stop
 * showing what a task *is*.
 */
function TaskCell({ task }: { task: TaskListItem }) {
  const attributesShown = useColumnVisible(ATTRIBUTES.key);
  return (
    <Cell column={TASK} truncate={false}>
      <Link
        to={`/tasks/${encodeURIComponent(task.id)}`}
        className="flex min-w-0 items-baseline gap-2 underline-offset-2 hover:underline"
      >
        <span className="shrink-0 font-mono text-xs text-muted-foreground">{task.id}</span>
        <span className="truncate">{task.title}</span>
      </Link>
      {attributesShown ? null : (
        <span className="mt-0.5 flex flex-wrap items-center gap-1 pb-1">
          <TaskFlags task={task} showDomain />
        </span>
      )}
    </Cell>
  );
}

export function TasksPage() {
  const { project } = useActiveProject();
  const filters = useUiStore((state) => state.taskFilters);
  const { data, isPending, error } = useTasks(project, toTaskQueryParams(filters));

  const serverTasks = data?.tasks ?? [];
  const rows = filterTasks(serverTasks, filters);
  const narrowed = hasClientOnlyNarrowing(filters);

  return (
    <Screen rhythm="tight">
      <TaskFilterBar
        milestones={facetValues(serverTasks, (task) => task.milestone)}
        domains={facetValues(serverTasks, (task) => task.domain)}
      />

      {error ? (
        error instanceof ApiError && error.status === 409 ? (
          <Banner tone="info">This project has no store yet — nothing to list.</Banner>
        ) : (
          <Banner tone="bad">Could not read the task list.</Banner>
        )
      ) : null}

      <Region
        title="Tasks"
        meta={
          isPending
            ? undefined
            : narrowed
              ? `${formatInteger(rows.length)} of ${formatInteger(data?.total ?? 0)} matching`
              : formatInteger(rows.length)
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
          <DataTable columns={COLUMNS} minWidth="34rem">
            {rows.map((task) => {
              const deps = task.deps ?? [];
              return (
                <Row key={task.id} interactive>
                  <Cell column={STATUS}>
                    <TaskStatusBadge status={task.status} />
                  </Cell>
                  <TaskCell task={task} />
                  <Cell column={ATTRIBUTES}>
                    <span className="flex items-center gap-1 overflow-hidden">
                      <TaskFlags task={task} showDomain />
                      {deps.length > 0 ? (
                        <Chip title={`Depends on ${deps.join(", ")}`}>
                          {deps.length} dep{deps.length === 1 ? "" : "s"}
                        </Chip>
                      ) : null}
                    </span>
                  </Cell>
                  <Cell column={RETRIES} numeric>
                    {task.retries === 0 ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      task.retries
                    )}
                  </Cell>
                  <Cell column={COST} numeric>
                    {task.cost_usd === 0 ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      formatUsd(task.cost_usd)
                    )}
                  </Cell>
                  <Cell column={MILESTONE} className="text-muted-foreground">
                    {textOrDash(task.milestone)}
                  </Cell>
                </Row>
              );
            })}
          </DataTable>
        )}
      </Region>
    </Screen>
  );
}
