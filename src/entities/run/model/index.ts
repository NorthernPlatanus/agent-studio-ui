import type { components } from "@/shared/api/generated";

export { runKeys } from "./run-keys";

export type RunListItem = components["schemas"]["RunListItem"];
export type RunDetail = components["schemas"]["RunDetail"];
export type Runs = components["schemas"]["Runs"];
export type TokenChannels = components["schemas"]["TokenChannels"];
export type ChannelTotals = components["schemas"]["ChannelTotals"];

export const RUN_STATUSES = ["running", "paused", "done", "aborted"] as const;

/** A run the panel would offer to resume, once phase 3 ships job control. */
export function isResumable(run: Pick<RunListItem, "status">): boolean {
  return run.status === "paused";
}

export function isActive(run: Pick<RunListItem, "status">): boolean {
  return run.status === "running" || run.status === "paused";
}

/**
 * The two billing channels, always as a pair and never summed: cash `cost` is
 * money, subscription `cost` is notional quota (CONTRACT §3). A channel may be
 * absent, which means "no calls on this channel", not zero cost.
 */
export interface ChannelView {
  channel: "cash" | "subscription";
  label: string;
  totals: ChannelTotals | null;
}

export function channelViews(tokens: TokenChannels | undefined): ChannelView[] {
  return [
    { channel: "cash", label: "Cash", totals: tokens?.cash ?? null },
    { channel: "subscription", label: "Subscription", totals: tokens?.subscription ?? null },
  ];
}

/**
 * Cache hit rate for a channel: `null` when the provider reported no cache
 * telemetry at all, which must render as `—` and never as 0%.
 */
export function channelCacheHitRate(totals: ChannelTotals | null): number | null {
  if (!totals) return null;
  const observed = totals.cache_hit + totals.cache_miss;
  if (observed === 0) return null;
  return totals.cache_hit / observed;
}
