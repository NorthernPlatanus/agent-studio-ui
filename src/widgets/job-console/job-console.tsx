/**
 * Supervised jobs — `run` / `plan` / `resume` / `import-backlog` subprocesses.
 *
 * The list is the console: `run_id` is resolved server-side per row, so a job
 * links straight to the run it started without opening a detail drawer first.
 * A `failed` job with `exit_code: null` is rendered as "exit code unknown"
 * rather than as a zero — the API adopts sidecars after a restart and cannot
 * recover a code it never waited on (`DECISIONS.md` 2026-08-07).
 */

import { Link } from "react-router";
import { isJobLive, type Job, jobOutcome, jobTone } from "@/entities/job";
import { useJobs } from "@/entities/job/api";
import { useNow } from "@/shared/hooks";
import { formatDuration, humanize } from "@/shared/lib/format";
import { EmptyState } from "@/shared/ui/region";
import { Skeleton } from "@/shared/ui/skeleton";
import { StatusDot } from "@/shared/ui/status-dot";

function JobRow({ job, now }: { job: Job; now: number }) {
  const live = isJobLive(job);
  const elapsed = (job.ended_at ?? now) - job.started_at;

  return (
    <li className="flex items-center gap-2.5 px-3 py-2">
      <StatusDot tone={jobTone(job.status)} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-mono text-[12px]">{job.command}</span>
        <span className="block truncate text-[11px] text-muted-foreground">
          {humanize(job.status)} · {jobOutcome(job)}
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span className="block text-[11px] tabular-nums text-muted-foreground">
          {formatDuration(elapsed)}
        </span>
        {job.run_id ? (
          <Link
            to={`/runs/${encodeURIComponent(job.run_id)}`}
            className="block text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            run
          </Link>
        ) : null}
      </span>
      {live ? <span className="sr-only">running</span> : null}
    </li>
  );
}

export function JobConsole({ project, limit }: { project: string | null; limit?: number }) {
  const { data, isPending, error } = useJobs(project);
  const jobs = data?.jobs ?? [];
  const anyLive = jobs.some(isJobLive);
  const now = useNow(anyLive);

  if (error) return <EmptyState>Could not read the job list.</EmptyState>;
  if (isPending) return <Skeleton className="m-3 h-12" />;
  if (jobs.length === 0) {
    return <EmptyState>No jobs have been started from the panel.</EmptyState>;
  }

  const shown = limit === undefined ? jobs : jobs.slice(0, limit);
  return (
    <ul className="divide-y divide-border/50">
      {shown.map((job) => (
        <JobRow key={job.job_id} job={job} now={now} />
      ))}
    </ul>
  );
}
