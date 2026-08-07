import type { components } from "@/shared/api/generated";

export { usageKeys } from "./usage-keys";

export type Usage = components["schemas"]["Usage"];
export type UsageRow = components["schemas"]["UsageRow"];

export const USAGE_GROUPINGS = ["role", "model", "provider", "day"] as const;
export type UsageGrouping = (typeof USAGE_GROUPINGS)[number];

/**
 * Every `…/usage` row is split by billing channel: one row per (group, `cash`)
 * pair, each with its own `cache_hit_rate` (CONTRACT §3). Group by `key` **and**
 * `cash` — a merged row makes the cache rate unattributable, and summing the
 * costs produces a figure that is part money and part notional quota.
 */
export interface UsageGroup {
  key: string;
  cash: UsageRow | null;
  subscription: UsageRow | null;
}

export function groupUsageByKey(rows: readonly UsageRow[]): UsageGroup[] {
  const groups = new Map<string, UsageGroup>();
  for (const row of rows) {
    const group = groups.get(row.key) ?? { key: row.key, cash: null, subscription: null };
    if (row.cash) group.cash = row;
    else group.subscription = row;
    groups.set(row.key, group);
  }
  return [...groups.values()];
}
