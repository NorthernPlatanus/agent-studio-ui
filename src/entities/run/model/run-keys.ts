import type { QueryKey } from "@tanstack/react-query";

/**
 * TanStack Query key factory for `run`. The project is always the first segment
 * after the entity name so switching projects can never show another project's
 * cached data (PLAN §4.2).
 */
export const runKeys = {
  all: (project: string): QueryKey => ["run", project],
  list: (project: string, filters?: unknown): QueryKey =>
    filters === undefined ? ["run", project, "list"] : ["run", project, "list", filters],
  detail: (project: string, id: string): QueryKey => ["run", project, "detail", id],
} as const;
