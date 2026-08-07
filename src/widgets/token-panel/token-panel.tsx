/**
 * Tokens and spend, by billing channel.
 *
 * The two channels are shown side by side and **never summed** (CONTRACT §3):
 * cash `cost` is money, subscription `cost` is notional quota. A single
 * "total cost" figure across both would be the most confidently wrong number on
 * the page.
 *
 * `cache_hit_rate` renders as `—` when the provider reported no telemetry at
 * all — a measured 0% and "we don't know" are different answers.
 */

import { channelCacheHitRate, channelViews, type TokenChannels } from "@/entities/run";
import { formatInteger, formatRate, formatTokens, formatUsd } from "@/shared/lib/format";
import { Field } from "@/shared/ui/metric";
import { EmptyState } from "@/shared/ui/region";

export function TokenPanel({ tokens }: { tokens: TokenChannels | undefined }) {
  const views = channelViews(tokens);
  if (views.every((view) => view.totals === null)) {
    return <EmptyState>No LLM calls recorded.</EmptyState>;
  }

  return (
    <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
      {views.map(({ channel, label, totals }) => (
        <section key={channel}>
          <h3 className="mb-1.5 flex items-baseline gap-2">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {label}
            </span>
            <span className="text-lg font-semibold tabular-nums">
              {totals === null
                ? "—"
                : channel === "cash"
                  ? formatUsd(totals.cost)
                  : `${formatTokens(totals.in_tok + totals.out_tok)} tok`}
            </span>
          </h3>

          {totals === null ? (
            <p className="text-[13px] text-muted-foreground">No calls on this channel.</p>
          ) : (
            <dl className="divide-y divide-border/50">
              <Field label="Calls">{formatInteger(totals.calls)}</Field>
              <Field label="In / out">
                <span className="tabular-nums">
                  {formatTokens(totals.in_tok)} / {formatTokens(totals.out_tok)}
                </span>
              </Field>
              <Field label="Cache hit rate">
                <span className="tabular-nums">{formatRate(channelCacheHitRate(totals))}</span>
              </Field>
              <Field label={channel === "cash" ? "Spend" : "Notional"}>
                <span className="tabular-nums">{formatUsd(totals.cost)}</span>
              </Field>
            </dl>
          )}
        </section>
      ))}
    </div>
  );
}
