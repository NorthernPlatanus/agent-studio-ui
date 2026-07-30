import type { QueryKey } from "@tanstack/react-query";

/**
 * TanStack Query key factory for `usage`. The project is always the first segment
 * after the entity name so switching projects can never show another project's
 * cached data (PLAN §4.2).
 */
export const usageKeys = {
  all: (project: string): QueryKey => ["usage", project],
  list: (project: string, filters?: unknown): QueryKey =>
    filters === undefined ? ["usage", project, "list"] : ["usage", project, "list", filters],
  detail: (project: string, id: string): QueryKey => ["usage", project, "detail", id],
} as const;
