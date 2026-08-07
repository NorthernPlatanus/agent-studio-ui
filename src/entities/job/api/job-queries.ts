import { queryOptions, useQuery } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { projectPath } from "@/shared/api/paths";
import type { Job, JobLog, Jobs } from "../model";
import { jobKeys } from "../model/job-keys";

export function jobsQuery(project: string) {
  return queryOptions({
    queryKey: jobKeys.list(project),
    queryFn: ({ signal }) => api.get<Jobs>(projectPath(project, "/jobs"), { signal }),
  });
}

/**
 * The job list. `run_id` is resolved server-side per row, so the console can link
 * a job straight to its run without opening the detail drawer first
 * (`DECISIONS.md` 2026-08-07).
 */
export function useJobs(project: string | null) {
  return useQuery({ ...jobsQuery(project ?? ""), enabled: project !== null });
}

export function jobQuery(project: string, jobId: string) {
  return queryOptions({
    queryKey: jobKeys.detail(project, jobId),
    queryFn: ({ signal }) =>
      api.get<Job>(projectPath(project, `/jobs/${encodeURIComponent(jobId)}`), { signal }),
  });
}

export function useJob(project: string | null, jobId: string | null | undefined) {
  const enabled = project !== null && jobId !== null && jobId !== undefined && jobId !== "";
  return useQuery({ ...jobQuery(project ?? "", jobId ?? ""), enabled });
}

/**
 * A chunk of a job's log from `offset`.
 *
 * The server returns the **clamped** start offset, so `offset <= next_offset`
 * always holds and a console that trusts the pair to advance cannot be rewound
 * by a request past EOF.
 */
export function jobLogQuery(project: string, jobId: string, offset: number) {
  return queryOptions({
    queryKey: [...jobKeys.detail(project, jobId), "log", offset],
    queryFn: ({ signal }) =>
      api.get<JobLog>(projectPath(project, `/jobs/${encodeURIComponent(jobId)}/log`), {
        query: { offset },
        signal,
      }),
  });
}
