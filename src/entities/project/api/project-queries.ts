import { queryOptions, useQuery } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import type { components } from "@/shared/api/generated";
import { PROJECTS_PATH, projectPath } from "@/shared/api/paths";
import { projectKeys } from "../model/project-keys";

type Projects = components["schemas"]["Projects"];
type Summary = components["schemas"]["Summary"];
type Metrics = components["schemas"]["Metrics"];
type Waves = components["schemas"]["Waves"];

export function projectsQuery() {
  return queryOptions({
    queryKey: projectKeys.list(),
    queryFn: ({ signal }) => api.get<Projects>(PROJECTS_PATH, { signal }),
    // The set of projects on disk changes about never; the store-presence flags
    // change when a project first runs. A minute is plenty.
    staleTime: 60_000,
  });
}

/** Discovered projects + which one `ORCH_PROJECT` points at. */
export function useProjects() {
  return useQuery(projectsQuery());
}

/**
 * The one-call dashboard read: queue/domain stats, active + last run, token
 * totals by channel, exception event counts, and the event-log head rowid.
 */
export function summaryQuery(project: string) {
  return queryOptions({
    queryKey: projectKeys.summary(project),
    queryFn: ({ signal }) => api.get<Summary>(projectPath(project, "/summary"), { signal }),
  });
}

export function useSummary(project: string | null) {
  return useQuery({ ...summaryQuery(project ?? ""), enabled: project !== null });
}

export function metricsQuery(project: string) {
  return queryOptions({
    queryKey: projectKeys.metrics(project),
    queryFn: ({ signal }) => api.get<Metrics>(projectPath(project, "/metrics"), { signal }),
  });
}

export function useMetrics(project: string | null) {
  return useQuery({ ...metricsQuery(project ?? ""), enabled: project !== null });
}

/** Zero-token schedule preview. Read-only: it spends nothing. */
export function wavesQuery(project: string) {
  return queryOptions({
    queryKey: projectKeys.waves(project),
    queryFn: ({ signal }) => api.get<Waves>(projectPath(project, "/waves"), { signal }),
  });
}

export function useWaves(project: string | null) {
  return useQuery({ ...wavesQuery(project ?? ""), enabled: project !== null });
}
