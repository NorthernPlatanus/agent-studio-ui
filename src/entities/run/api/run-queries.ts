import { queryOptions, useQuery } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { projectPath, runPath } from "@/shared/api/paths";
import type { RunDetail, Runs } from "../model";
import { runKeys } from "../model/run-keys";

export function runsQuery(project: string, limit = 50) {
  return queryOptions({
    queryKey: runKeys.list(project, { limit }),
    queryFn: ({ signal }) =>
      api.get<Runs>(projectPath(project, "/runs"), { query: { limit }, signal }),
  });
}

/** Run rows with per-run token totals split by billing channel. */
export function useRuns(project: string | null, limit = 50) {
  return useQuery({ ...runsQuery(project ?? "", limit), enabled: project !== null });
}

export function runQuery(project: string, runId: string, eventLimit = 500) {
  return queryOptions({
    queryKey: runKeys.detail(project, runId),
    queryFn: ({ signal }) =>
      api.get<RunDetail>(runPath(project, runId), {
        query: { event_limit: eventLimit },
        signal,
      }),
  });
}

/** Run detail: task ids touched, the run's events, token totals, pause reason. */
export function useRun(project: string | null, runId: string | null | undefined, eventLimit = 500) {
  const enabled = project !== null && runId !== null && runId !== undefined && runId !== "";
  return useQuery({ ...runQuery(project ?? "", runId ?? "", eventLimit), enabled });
}
