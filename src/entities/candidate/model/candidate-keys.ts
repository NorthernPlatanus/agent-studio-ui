import type { QueryKey } from "@tanstack/react-query";

/**
 * TanStack Query key factory for `candidate`. The project is always the first segment
 * after the entity name so switching projects can never show another project's
 * cached data (PLAN §4.2).
 */
export const candidateKeys = {
  all: (project: string): QueryKey => ["candidate", project],
  list: (project: string, filters?: unknown): QueryKey =>
    filters === undefined
      ? ["candidate", project, "list"]
      : ["candidate", project, "list", filters],
  detail: (project: string, id: string): QueryKey => ["candidate", project, "detail", id],
} as const;
