import type { QueryKey } from "@tanstack/react-query";

/**
 * TanStack Query key factory for `event`. The project is always the first segment
 * after the entity name so switching projects can never show another project's
 * cached data (PLAN §4.2).
 */
export const eventKeys = {
  all: (project: string): QueryKey => ["event", project],
  list: (project: string, filters?: unknown): QueryKey =>
    filters === undefined ? ["event", project, "list"] : ["event", project, "list", filters],
  detail: (project: string, id: string): QueryKey => ["event", project, "detail", id],
} as const;
