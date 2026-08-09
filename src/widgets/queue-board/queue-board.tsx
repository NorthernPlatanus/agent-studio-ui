/**
 * The queue, as a proportional bar plus its counts.
 *
 * Deliberately one bar rather than eight stat tiles: the question an operator
 * asks of a backlog is *what is the shape of it* — how much is blocked on a
 * human against how much is ready — and eight equal boxes answer that worse than
 * one hundred-percent-stacked row does.
 *
 * Every segment is also a link into the pre-filtered table, so the picture is
 * the navigation.
 */

import { Link } from "react-router";
import { TASK_STATUSES, taskStatusTone } from "@/entities/task";
import { formatInteger, humanize } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";
import { EmptyState } from "@/shared/ui/region";
import { StatusDot } from "@/shared/ui/status-dot";

const BAR: Record<string, string> = {
  neutral: "bg-status-neutral",
  progress: "bg-status-progress",
  good: "bg-status-good",
  warn: "bg-status-warn",
  bad: "bg-status-bad",
};

export function QueueBoard({ queueStats }: { queueStats: Readonly<Record<string, number>> }) {
  const rows = TASK_STATUSES.map((status) => ({
    status,
    count: queueStats[status] ?? 0,
    tone: taskStatusTone(status),
  })).filter((row) => row.count > 0);

  const total = rows.reduce((sum, row) => sum + row.count, 0);
  if (total === 0) return <EmptyState>The backlog is empty.</EmptyState>;

  return (
    <div className="space-y-4">
      <div className="flex h-2 gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
        {rows.map((row) => (
          <span
            key={row.status}
            className={cn(BAR[row.tone], "first:rounded-l-full last:rounded-r-full")}
            style={{ width: `${(row.count / total) * 100}%` }}
          />
        ))}
      </div>

      <ul className="grid grid-cols-2 gap-x-6 gap-y-1.5 @2xl:grid-cols-3">
        {rows.map((row) => (
          <li key={row.status}>
            <Link
              to={`/tasks?status=${row.status}`}
              className="flex items-baseline gap-2 rounded px-1 py-0.5 -mx-1 text-[13px] hover:bg-foreground/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <StatusDot tone={row.tone} pulse={false} className="translate-y-px" />
              <span className="min-w-0 flex-1 truncate text-muted-foreground">
                {humanize(row.status)}
              </span>
              <span className="shrink-0 font-medium tabular-nums">{formatInteger(row.count)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
