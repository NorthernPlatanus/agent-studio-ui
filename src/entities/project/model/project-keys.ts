import type { QueryKey } from "@tanstack/react-query";

/**
 * Query keys for `project`.
 *
 * Unlike every other entity this one's *list* has no project-first segment:
 * `GET /api/projects` is the discovery endpoint and is not project-scoped, so
 * there is nothing to scope by. The project-scoped aggregates that live in this
 * slice (`…/summary`, `…/metrics`, `…/waves`) do carry the project as their first
 * segment, per PLAN §4.2.
 */
export const projectKeys = {
  all: (): QueryKey => ["project"],
  list: (): QueryKey => ["project", "list"],
  /** Everything scoped to one project — the SSE invalidation target in phase 3. */
  scoped: (project: string): QueryKey => ["project", project],
  summary: (project: string): QueryKey => ["project", project, "summary"],
  metrics: (project: string): QueryKey => ["project", project, "metrics"],
  waves: (project: string): QueryKey => ["project", project, "waves"],
} as const;
