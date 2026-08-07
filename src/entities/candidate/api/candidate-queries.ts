import { queryOptions, useQuery } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { taskPath } from "@/shared/api/paths";
import type { Candidates } from "../model";
import { candidateKeys } from "../model/candidate-keys";

/**
 * Candidates belong to a task, not to an id of their own. `runId` is optional and
 * defaults server-side to the newest run that touched the task.
 */
export function taskCandidatesQuery(project: string, taskId: string, runId?: string | null) {
  return queryOptions({
    queryKey: candidateKeys.forTask(project, taskId, runId),
    queryFn: ({ signal }) =>
      api.get<Candidates>(taskPath(project, taskId, "/candidates"), {
        query: runId ? { run_id: runId } : {},
        signal,
      }),
  });
}

export function useTaskCandidates(
  project: string | null,
  taskId: string | null | undefined,
  runId?: string | null,
) {
  const enabled = project !== null && taskId !== null && taskId !== undefined && taskId !== "";
  return useQuery({ ...taskCandidatesQuery(project ?? "", taskId ?? "", runId), enabled });
}
