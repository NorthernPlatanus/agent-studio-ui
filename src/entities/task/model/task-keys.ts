import type { QueryKey } from "@tanstack/react-query";

/**
 * TanStack Query key factory for `task`. The project is always the first segment
 * after the entity name so switching projects can never show another project's
 * cached data (PLAN §4.2).
 */
export const taskKeys = {
  all: (project: string): QueryKey => ["task", project],
  list: (project: string, filters?: unknown): QueryKey =>
    filters === undefined ? ["task", project, "list"] : ["task", project, "list", filters],
  detail: (project: string, id: string): QueryKey => ["task", project, "detail", id],
} as const;
