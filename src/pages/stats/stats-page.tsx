/**
 * Statistics.
 *
 * The tables are real — `…/usage` and `…/metrics` both exist — and the charts
 * are plugged, because chart work follows the `dataviz` skill and is its own
 * pass. Every figure here respects the `null` ≠ `0` rule (CONTRACT §3): a
 * provider that reported no cache telemetry shows `—`, not `0%`.
 */

import { useState } from "react";
import { useMetrics } from "@/entities/project/api";
import { groupUsageByKey, USAGE_GROUPINGS, type UsageGrouping } from "@/entities/usage";
import { useUsage } from "@/entities/usage/api";
import { useActiveProject } from "@/features/project-switch/use-active-project";
import {
  formatInteger,
  formatRate,
  formatTokens,
  formatTokensOrDash,
  formatUsd,
  formatUsdOrDash,
  humanize,
} from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";
import { Metric, MetricRow } from "@/shared/ui/metric";
import { Panel, PanelBody, PanelHeader } from "@/shared/ui/panel";
import { EmptyState, Region } from "@/shared/ui/region";
import { Skeleton } from "@/shared/ui/skeleton";
import { Soon, SoonOverlay } from "@/shared/ui/soon";

const TH =
  "h-8 px-3 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground";
const TD = "px-3 py-1.5 align-middle";

export function StatsPage() {
  const { project } = useActiveProject();
  const [groupBy, setGroupBy] = useState<UsageGrouping>("role");
  const usage = useUsage(project, groupBy);
  const metrics = useMetrics(project);

  const groups = groupUsageByKey(usage.data?.rows ?? []);

  return (
    <div className="space-y-4 pt-1">
      {metrics.data ? (
        <MetricRow>
          <Metric
            label="Completed tasks"
            value={formatInteger(metrics.data.completed_tasks)}
            hint="the denominator below"
          />
          <Metric
            label="Subscription in / task"
            value={formatTokensOrDash(metrics.data.subscription_in_tok_per_completed_task)}
            hint="the quota proxy"
          />
          <Metric
            label="Cash / task"
            value={formatUsdOrDash(metrics.data.cash_usd_per_completed_task)}
            hint="money, not quota"
          />
        </MetricRow>
      ) : (
        <Skeleton className="h-24 w-full" />
      )}

      <Region title="Charts">
        <SoonOverlay note="Token-over-time and cost-per-task charts land with the chart pass.">
          <div className="grid gap-3 sm:grid-cols-2">
            {["Tokens by channel over time", "Cost per completed task"].map((title) => (
              <Panel key={title}>
                <PanelHeader title={title} />
                <PanelBody>
                  <div className="h-40 rounded-md bg-foreground/[0.04]" />
                </PanelBody>
              </Panel>
            ))}
          </div>
        </SoonOverlay>
      </Region>

      <Panel>
        <PanelHeader
          title="Usage"
          actions={
            <div className="flex gap-0.5 rounded-lg border border-border p-0.5">
              {USAGE_GROUPINGS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setGroupBy(option)}
                  className={cn(
                    "rounded-md px-2 py-1 text-[12px] transition-colors",
                    option === groupBy
                      ? "bg-foreground/10 font-medium text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {humanize(option)}
                </button>
              ))}
            </div>
          }
        />
        <PanelBody flush>
          {usage.isPending ? (
            <Skeleton className="m-5 h-32" />
          ) : groups.length === 0 ? (
            <div className="p-5">
              <EmptyState>No LLM calls recorded for this project.</EmptyState>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[46rem] border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className={TH}>{humanize(groupBy)}</th>
                    <th className={TH}>Channel</th>
                    <th className={`${TH} text-right`}>Calls</th>
                    <th className={`${TH} text-right`}>In</th>
                    <th className={`${TH} text-right`}>Out</th>
                    <th className={`${TH} text-right`}>Cache hit</th>
                    <th className={`${TH} text-right`}>Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.flatMap((group) =>
                    (["subscription", "cash"] as const).flatMap((channel) => {
                      const row = group[channel];
                      if (!row) return [];
                      return [
                        <tr key={`${group.key}-${channel}`} className="border-b border-border/50">
                          <td className={`${TD} font-medium`}>{group.key}</td>
                          <td className={`${TD} text-muted-foreground`}>{channel}</td>
                          <td className={`${TD} text-right tabular-nums`}>
                            {formatInteger(row.calls)}
                          </td>
                          <td className={`${TD} text-right tabular-nums`}>
                            {formatTokens(row.in_tok)}
                          </td>
                          <td className={`${TD} text-right tabular-nums`}>
                            {formatTokens(row.out_tok)}
                          </td>
                          <td className={`${TD} text-right tabular-nums`}>
                            {formatRate(row.cache_hit_rate)}
                          </td>
                          <td className={`${TD} text-right tabular-nums`}>
                            {channel === "cash" ? (
                              formatUsd(row.cost)
                            ) : (
                              <span
                                className="text-muted-foreground"
                                title="Notional quota, not money"
                              >
                                {formatUsd(row.cost)}
                              </span>
                            )}
                          </td>
                        </tr>,
                      ];
                    }),
                  )}
                </tbody>
              </table>
            </div>
          )}
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader
          title="Solve rate by candidate model"
          meta="from gate outcomes"
          actions={metrics.data?.gate_outcomes.length === 0 ? <Soon label="No data" /> : null}
        />
        <PanelBody flush>
          {metrics.isPending ? (
            <Skeleton className="m-5 h-24" />
          ) : (metrics.data?.gate_outcomes.length ?? 0) === 0 ? (
            <div className="p-5">
              <EmptyState>No gate outcomes recorded yet.</EmptyState>
            </div>
          ) : (
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-border">
                  <th className={TH}>Candidate</th>
                  <th className={TH}>Attempt</th>
                  <th className={`${TH} text-right`}>Passed</th>
                  <th className={`${TH} text-right`}>Failed</th>
                  <th className={`${TH} text-right`}>Pass rate</th>
                </tr>
              </thead>
              <tbody>
                {metrics.data?.gate_outcomes.map((outcome) => (
                  <tr
                    key={`${outcome.cand_id}-${outcome.first_attempt}`}
                    className="border-b border-border/50"
                  >
                    <td className={`${TD} font-mono text-xs`}>{outcome.cand_id}</td>
                    <td className={`${TD} text-muted-foreground`}>
                      {outcome.first_attempt ? "first" : "retry"}
                    </td>
                    <td className={`${TD} text-right tabular-nums`}>{outcome.passed}</td>
                    <td className={`${TD} text-right tabular-nums`}>{outcome.failed}</td>
                    <td className={`${TD} text-right tabular-nums`}>
                      {formatRate(outcome.pass_rate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </PanelBody>
      </Panel>
    </div>
  );
}
