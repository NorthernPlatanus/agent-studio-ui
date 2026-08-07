import { queryOptions, useQuery } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { projectPath, taskPath } from "@/shared/api/paths";
import type { TaskQueryParams } from "../model/task-filters";
import { taskKeys } from "../model/task-keys";
import type { TaskDetail, Tasks } from "../model/task-types";

export function tasksQuery(project: string, params: TaskQueryParams = {}) {
  return queryOptions({
    queryKey: taskKeys.list(project, params),
    queryFn: ({ signal }) =>
      api.get<Tasks>(projectPath(project, "/tasks"), { query: params, signal }),
  });
}

/** The task table's read. `params` is the server-expressible half of the filters. */
export function useTasks(project: string | null, params: TaskQueryParams = {}) {
  return useQuery({ ...tasksQuery(project ?? "", params), enabled: project !== null });
}

export function taskQuery(project: string, taskId: string) {
  return queryOptions({
    queryKey: taskKeys.detail(project, taskId),
    queryFn: ({ signal }) => api.get<TaskDetail>(taskPath(project, taskId), { signal }),
  });
}

/** Full spec + retries + lifetime cash spend + the task's own event timeline. */
export function useTask(project: string | null, taskId: string | null | undefined) {
  const enabled = project !== null && taskId !== null && taskId !== undefined && taskId !== "";
  return useQuery({ ...taskQuery(project ?? "", taskId ?? ""), enabled });
}
