import type { QueryKey } from "@tanstack/react-query";

/**
 * TanStack Query key factory for `project`. The project is always the first segment
 * after the entity name so switching projects can never show another project's
 * cached data (PLAN §4.2).
 */
export const projectKeys = {
  all: (project: string): QueryKey => ["project", project],
  list: (project: string, filters?: unknown): QueryKey =>
    filters === undefined ? ["project", project, "list"] : ["project", project, "list", filters],
  detail: (project: string, id: string): QueryKey => ["project", project, "detail", id],
} as const;
