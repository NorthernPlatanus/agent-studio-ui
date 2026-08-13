/**
 * The four spawners and the stopper.
 *
 * Every one of these starts a **real `python -m orchestrator …` subprocess** on
 * the operator's machine (PLAN §3.1 rule 1). Three of them spend quota. The
 * guards that matter are server-side and this layer must not paper over them:
 *
 *  - a body without `confirm` is **422**, not 409 — the body is what is wrong;
 *  - `dry_run` needs no confirmation and spends nothing;
 *  - one job in flight per project, enforced under a lock — a double-click gets
 *    a guaranteed 409, not a second orchestrator process;
 *  - preconditions are ordered so they can be told apart: 404 unknown project →
 *    409 no `repo_path` → 409 job in flight → 404 nothing paused to resume.
 *
 * `JobAccepted.argv` is the exact command line spawned, and the UI shows it, so
 * a human can reproduce or continue the job in a terminal.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import type { components } from "@/shared/api/generated";
import { projectPath } from "@/shared/api/paths";
import type { Job } from "../model";
import { jobKeys } from "../model/job-keys";

export type RunRequest = components["schemas"]["RunRequest"];
export type PlanRequest = components["schemas"]["PlanRequest"];
export type ResumeRequest = components["schemas"]["ResumeRequest"];
export type JobAccepted = components["schemas"]["JobAccepted"];

function jobsPath(project: string, suffix: string): string {
  return projectPath(project, `/jobs${suffix}`);
}

/**
 * Invalidate everything a spawned job immediately changes. The job list first,
 * because the console renders from it; runs and tasks because the child writes
 * to the store within a second or two and the SSE cursor may not have ticked.
 */
function useJobInvalidation(project: string) {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: jobKeys.all(project) });
    void queryClient.invalidateQueries({ queryKey: ["run", project] });
    void queryClient.invalidateQueries({ queryKey: ["task", project] });
    void queryClient.invalidateQueries({ queryKey: ["project", project] });
  };
}

export function useStartRun(project: string | null) {
  const invalidate = useJobInvalidation(project ?? "");
  return useMutation({
    mutationFn: (body: RunRequest) => api.post<JobAccepted>(jobsPath(project ?? "", "/run"), body),
    onSuccess: invalidate,
  });
}

export function useStartPlan(project: string | null) {
  const invalidate = useJobInvalidation(project ?? "");
  return useMutation({
    mutationFn: (body: PlanRequest) =>
      api.post<JobAccepted>(jobsPath(project ?? "", "/plan"), body),
    onSuccess: invalidate,
  });
}

export function useResumeRun(project: string | null) {
  const invalidate = useJobInvalidation(project ?? "");
  return useMutation({
    mutationFn: (body: ResumeRequest) =>
      api.post<JobAccepted>(jobsPath(project ?? "", "/resume"), body),
    onSuccess: invalidate,
  });
}

/** Free: registers backlog stubs from markdown. No LLM, no confirmation. */
export function useImportBacklog(project: string | null) {
  const invalidate = useJobInvalidation(project ?? "");
  return useMutation({
    mutationFn: () => api.post<JobAccepted>(jobsPath(project ?? "", "/import-backlog")),
    onSuccess: invalidate,
  });
}

/**
 * Free: closes out runs whose process died without writing a terminal status.
 *
 * The store's `status` column is a claim the runner only updates on the paths
 * that unwind — a killed process leaves `running` behind forever, and every
 * "is something running" reader believes it. This is the remedy; the `stale`
 * flag on each run is the detection.
 */
export function useReconcileRuns(project: string | null) {
  const invalidate = useJobInvalidation(project ?? "");
  return useMutation({
    mutationFn: () => api.post<JobAccepted>(jobsPath(project ?? "", "/reconcile")),
    onSuccess: invalidate,
  });
}

/**
 * SIGINT → grace → SIGTERM → SIGKILL, awaited server-side; the response is the
 * job's final state. A stopped run stays resumable from its checkpoint.
 */
export function useStopJob(project: string | null) {
  const invalidate = useJobInvalidation(project ?? "");
  return useMutation({
    mutationFn: (jobId: string) =>
      api.post<Job>(jobsPath(project ?? "", `/${encodeURIComponent(jobId)}/stop`)),
    onSuccess: invalidate,
  });
}
