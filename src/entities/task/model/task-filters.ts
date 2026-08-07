/**
 * The filter split.
 *
 * `GET …/tasks` accepts `status`, `milestone`, `domain`, `parent_id` and `q` —
 * one value each. PLAN §4.4 also wants risk, complexity, visual and agent_able,
 * and the table allows selecting more than one status. Those have no server
 * param, so they are narrowed client-side over the server-filtered page.
 *
 * Consequence the UI must respect: `Tasks.total` and `Tasks.queue_stats` describe
 * the **server**-filtered set, so once a client-side narrowing is active the
 * visible row count is the authority, not `total`.
 */

import type { TaskFilters } from "@/shared/store/ui-store";
import type { TaskListItem } from "./task-types";

/** Exactly the query params `…/tasks` documents. Values are `undefined` when unset. */
export type TaskQueryParams = {
  status?: string;
  milestone?: string;
  domain?: string;
  parent_id?: string;
  q?: string;
};

/** The statuses the store records, in pipeline-ish order. */
export const TASK_STATUSES = [
  "needs_plan",
  "ready",
  "running",
  "done",
  "needs_human",
  "failed",
  "rejected",
  "human_only",
] as const;

export const TASK_RISKS = ["low", "medium", "high"] as const;
export const TASK_COMPLEXITIES = ["s", "m", "l"] as const;

/**
 * Server-side half of the filter state. A single selected status is pushed to the
 * server; two or more cannot be expressed, so all of them are narrowed on the
 * client instead and the server sees no `status` at all.
 */
export function toTaskQueryParams(filters: TaskFilters): TaskQueryParams {
  const params: TaskQueryParams = {};
  const [onlyStatus] = filters.status;
  if (filters.status.length === 1 && onlyStatus !== undefined) params.status = onlyStatus;
  if (filters.milestone !== null) params.milestone = filters.milestone;
  if (filters.domain !== null) params.domain = filters.domain;
  const q = filters.search.trim();
  if (q !== "") params.q = q;
  return params;
}

/** True when the client still has narrowing to do after the server's page arrives. */
export function hasClientOnlyNarrowing(filters: TaskFilters): boolean {
  return (
    filters.status.length > 1 ||
    filters.risk !== null ||
    filters.complexity !== null ||
    filters.visual !== null ||
    filters.agentAble !== null
  );
}

/** Client-side half. Applied to whatever the server returned. */
export function matchesTaskFilters(task: TaskListItem, filters: TaskFilters): boolean {
  if (filters.status.length > 1 && !filters.status.includes(task.status)) return false;
  if (filters.risk !== null && task.risk !== filters.risk) return false;
  if (filters.complexity !== null && task.complexity !== filters.complexity) return false;
  // `visual` / `agent_able` are nullable server-side; an unset flag is not a `false`.
  if (filters.visual !== null && (task.visual ?? false) !== filters.visual) return false;
  if (filters.agentAble !== null && (task.agent_able ?? false) !== filters.agentAble) return false;
  return true;
}

export function filterTasks(tasks: readonly TaskListItem[], filters: TaskFilters): TaskListItem[] {
  return tasks.filter((task) => matchesTaskFilters(task, filters));
}

/** Distinct non-null values for a facet, sorted — drives the filter dropdowns. */
export function facetValues(
  tasks: readonly TaskListItem[],
  pick: (task: TaskListItem) => string | null | undefined,
): string[] {
  const seen = new Set<string>();
  for (const task of tasks) {
    const value = pick(task);
    if (value !== null && value !== undefined && value !== "") seen.add(value);
  }
  return [...seen].sort();
}
