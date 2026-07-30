import type { QueryKey } from "@tanstack/react-query";

/**
 * TanStack Query key factory for `job`. The project is always the first segment
 * after the entity name so switching projects can never show another project's
 * cached data (PLAN §4.2).
 */
export const jobKeys = {
  all: (project: string): QueryKey => ["job", project],
  list: (project: string, filters?: unknown): QueryKey =>
    filters === undefined ? ["job", project, "list"] : ["job", project, "list", filters],
  detail: (project: string, id: string): QueryKey => ["job", project, "detail", id],
} as const;
