import type { QueryKey } from "@tanstack/react-query";

/**
 * Query keys for the planner chat. Project-first, like every other entity.
 *
 * There is only one key: the API exposes the whole session — status, settings,
 * pins and every frame — through `GET …/discuss`. Splitting it would mean four
 * caches that can disagree about which turn the conversation is on.
 */
export const discussKeys = {
  all: (project: string): QueryKey => ["discuss", project],
  state: (project: string): QueryKey => ["discuss", project, "state"],
} as const;
