import type { QueryKey } from "@tanstack/react-query";

/**
 * Query keys for `candidate`.
 *
 * There is **no per-candidate endpoint**: candidates are addressable only as a set
 * belonging to one task (`GET …/tasks/{task_id}/candidates`), optionally pinned to
 * a `run_id`. The phase-0 stub had a `detail(project, id)` key that implied an
 * endpoint that does not exist; `forTask` replaces it so the key factory cannot
 * mislead a caller into looking for one.
 */
export const candidateKeys = {
  all: (project: string): QueryKey => ["candidate", project],
  /** Candidates for one task; `runId` omitted means "the newest run for the task". */
  forTask: (project: string, taskId: string, runId?: string | null): QueryKey =>
    runId === undefined || runId === null
      ? ["candidate", project, "task", taskId]
      : ["candidate", project, "task", taskId, { runId }],
} as const;
