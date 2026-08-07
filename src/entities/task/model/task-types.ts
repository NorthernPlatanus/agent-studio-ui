import type { components } from "@/shared/api/generated";

/** Generated shapes, re-exported. Nothing here is handwritten. */
export type TaskListItem = components["schemas"]["TaskListItem"];
export type TaskDetail = components["schemas"]["TaskDetail"];
export type Tasks = components["schemas"]["Tasks"];

/**
 * The statuses that mean "the orchestrator is finished with this one, a human is
 * not" versus the ones that need attention. Used for badge tone only.
 */
export type TaskTone = "neutral" | "progress" | "good" | "warn" | "bad";

const TONES: Readonly<Record<string, TaskTone>> = {
  needs_plan: "neutral",
  ready: "neutral",
  running: "progress",
  done: "good",
  needs_human: "warn",
  human_only: "warn",
  failed: "bad",
  rejected: "bad",
};

export function taskStatusTone(status: string): TaskTone {
  return TONES[status] ?? "neutral";
}

/** `cash_spend_usd` is lifetime cash and is the figure to show (CONTRACT §3). */
export function taskSpend(task: TaskDetail): number {
  return task.cash_spend_usd;
}
