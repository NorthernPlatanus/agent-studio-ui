import type { components } from "@/shared/api/generated";

export { projectKeys } from "./project-keys";

/** Server shapes are generated, never handwritten — re-exported for convenience. */
export type Project = components["schemas"]["Project"];
export type Projects = components["schemas"]["Projects"];
export type Summary = components["schemas"]["Summary"];
export type Metrics = components["schemas"]["Metrics"];
export type Waves = components["schemas"]["Waves"];
export type TokenChannels = components["schemas"]["TokenChannels"];
export type ChannelTotals = components["schemas"]["ChannelTotals"];

/**
 * The exception counters PLAN §4.4 wants badged on the dashboard. Kept as a list
 * so the dashboard cannot silently drop one when the server adds a kind.
 */
export const EXCEPTION_EVENT_KINDS = [
  "escalated",
  "no_patch",
  "verify_unverifiable",
  "crashed",
  "visual_gate_error",
  "visual_gate_skipped",
  "retrieval_exhausted",
] as const;

export type ExceptionEventKind = (typeof EXCEPTION_EVENT_KINDS)[number];

/** `event_counts` is 0-filled server-side, so a missing key really is "never seen". */
export function exceptionCounts(
  counts: Readonly<Record<string, number>>,
): Array<{ kind: ExceptionEventKind; count: number }> {
  return EXCEPTION_EVENT_KINDS.map((kind) => ({ kind, count: counts[kind] ?? 0 }));
}

/**
 * Selects a project to show: the caller's choice when it still exists, else the
 * server's active project, else the first one discovered.
 */
export function resolveProject(
  projects: Projects | undefined,
  preferred: string | null,
): string | null {
  if (!projects) return null;
  const names = projects.projects.map((project) => project.name);
  if (preferred !== null && names.includes(preferred)) return preferred;
  if (
    projects.active !== null &&
    projects.active !== undefined &&
    names.includes(projects.active)
  ) {
    return projects.active;
  }
  return names[0] ?? null;
}

export function findProject(
  projects: Projects | undefined,
  name: string | null,
): Project | undefined {
  if (!projects || name === null) return undefined;
  return projects.projects.find((project) => project.name === name);
}
