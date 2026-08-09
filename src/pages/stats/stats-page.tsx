/**
 * Statistics.
 *
 * The tables are real — `…/usage` and `…/metrics` both exist — and the charts
 * are plugged, because chart work follows the `dataviz` skill and is its own
 * pass. Every figure here respects the `null` ≠ `0` rule (CONTRACT §3): a
 * provider that reported no cache telemetry shows `—`, not `0%`.
 *
 * The usage grouping switch is exactly the case fixed column widths exist for:
 * `role` keys are short (`worker`), `model` keys are long
 * (`deepseek/deepseek-chat`), and with content-derived widths every column in
 * the table jumped on each tab change.
 */

import { useState } from "react";
import { useMetrics } from "@/entities/project/api";
import { groupUsageByKey, USAGE_GROUPINGS, type UsageGrouping } from "@/entities/usage";
import { useUsage } from "@/entities/usage/api";
import { useActiveProject } from "@/features/project-switch";
import { ApiError } from "@/shared/api/client";
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
import { Banner } from "@/shared/ui/banner";
import { Cell, type Column, DataTable, Row } from "@/shared/ui/data-table";
import { Metric, MetricRow } from "@/shared/ui/metric";
import { Panel, PanelBody, PanelHeader } from "@/shared/ui/panel";
import { EmptyState, Region } from "@/shared/ui/region";
import { Screen } from "@/shared/ui/screen";
import { Skeleton } from "@/shared/ui/skeleton";
import { Soon, SoonOverlay } from "@/shared/ui/soon";

// Sized to the content, not to the header: `Calls` never exceeds four digits and
// a token figure is at most `1.24M`, so the slack belongs to the group key —
// which is `claude_cli / opus` under `group_by=model` and `worker` under `role`.
const KEY: Column = { key: "key", header: "Group" };
const CHANNEL: Column = { key: "channel", header: "Channel", width: "7rem" };
const CALLS: Column = { key: "calls", header: "Calls", width: "5rem", align: "right" };
const IN_TOK: Column = { key: "in", header: "In", width: "5.5rem", align: "right" };
const OUT_TOK: Column = { key: "out", header: "Out", width: "5.5rem", align: "right" };
const CACHE: Column = { key: "cache", header: "Cache hit", width: "6.5rem", align: "right" };
const COST: Column = { key: "cost", header: "Cost", width: "6.5rem", align: "right" };
const USAGE_COLUMNS = [KEY, CHANNEL, CALLS, IN_TOK, OUT_TOK, CACHE, COST];

const CAND: Column = { key: "cand", header: "Candidate" };
const ATTEMPT: Column = { key: "attempt", header: "Attempt", width: "6rem" };
const PASSED: Column = { key: "passed", header: "Passed", width: "6rem", align: "right" };
const FAILED: Column = { key: "failed", header: "Failed", width: "6rem", align: "right" };
const PASS_RATE: Column = { key: "rate", header: "Pass rate", width: "7rem", align: "right" };
const GATE_COLUMNS = [CAND, ATTEMPT, PASSED, FAILED, PASS_RATE];

export function StatsPage() {
  const { project } = useActiveProject();
  const [groupBy, setGroupBy] = useState<UsageGrouping>("role");
  const usage = useUsage(project, groupBy);
  const metrics = useMetrics(project);

  const groups = groupUsageByKey(usage.data?.rows ?? []);
  const gateOutcomes = metrics.data?.gate_outcomes ?? [];
  const metricsIs409 = metrics.error instanceof ApiError && metrics.error.status === 409;

  return (
    <Screen>
      {metrics.error ? (
        <Banner tone={metricsIs409 ? "info" : "bad"}>
          {metricsIs409
            ? "This project has no store yet — no statistics to compute."
            : "Could not read the project's metrics."}
        </Banner>
      ) : metrics.data ? (
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
          <div className="grid gap-3 @2xl:grid-cols-2">
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
                  aria-pressed={option === groupBy}
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
          {usage.error ? (
            <div className="p-5">
              {/* An error is not an empty result: "no calls recorded" would be a
                  confident lie about a request that never answered. */}
              <Banner tone="bad">Could not read usage for this project.</Banner>
            </div>
          ) : usage.isPending ? (
            <Skeleton className="m-5 h-32" />
          ) : groups.length === 0 ? (
            <div className="p-5">
              <EmptyState>No LLM calls recorded for this project.</EmptyState>
            </div>
          ) : (
            <DataTable columns={USAGE_COLUMNS} minWidth="44rem">
              {groups.flatMap((group) =>
                (["subscription", "cash"] as const).flatMap((channel) => {
                  const row = group[channel];
                  if (!row) return [];
                  return [
                    <Row key={`${group.key}-${channel}`}>
                      <Cell column={KEY} className="font-medium">
                        <span title={group.key}>{group.key}</span>
                      </Cell>
                      <Cell column={CHANNEL} className="text-muted-foreground">
                        {channel}
                      </Cell>
                      <Cell column={CALLS} numeric>
                        {formatInteger(row.calls)}
                      </Cell>
                      <Cell column={IN_TOK} numeric>
                        {formatTokens(row.in_tok)}
                      </Cell>
                      <Cell column={OUT_TOK} numeric>
                        {formatTokens(row.out_tok)}
                      </Cell>
                      <Cell column={CACHE} numeric>
                        {formatRate(row.cache_hit_rate)}
                      </Cell>
                      <Cell column={COST} numeric>
                        {channel === "cash" ? (
                          formatUsd(row.cost)
                        ) : (
                          <span className="text-muted-foreground" title="Notional quota, not money">
                            {formatUsd(row.cost)}
                          </span>
                        )}
                      </Cell>
                    </Row>,
                  ];
                }),
              )}
            </DataTable>
          )}
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader
          title="Solve rate by candidate model"
          meta="from gate outcomes"
          actions={
            !metrics.isPending && gateOutcomes.length === 0 ? <Soon label="No data" /> : null
          }
        />
        <PanelBody flush>
          {metrics.error ? (
            <div className="p-5">
              <Banner tone="bad">Could not read gate outcomes.</Banner>
            </div>
          ) : metrics.isPending ? (
            <Skeleton className="m-5 h-24" />
          ) : gateOutcomes.length === 0 ? (
            <div className="p-5">
              <EmptyState>No gate outcomes recorded yet.</EmptyState>
            </div>
          ) : (
            <DataTable columns={GATE_COLUMNS} minWidth="34rem">
              {gateOutcomes.map((outcome) => (
                <Row key={`${outcome.cand_id}-${outcome.first_attempt}`}>
                  <Cell column={CAND} className="font-mono text-xs">
                    <span title={outcome.cand_id}>{outcome.cand_id}</span>
                  </Cell>
                  <Cell column={ATTEMPT} className="text-muted-foreground">
                    {outcome.first_attempt ? "first" : "retry"}
                  </Cell>
                  <Cell column={PASSED} numeric>
                    {outcome.passed}
                  </Cell>
                  <Cell column={FAILED} numeric>
                    {outcome.failed}
                  </Cell>
                  <Cell column={PASS_RATE} numeric>
                    {formatRate(outcome.pass_rate)}
                  </Cell>
                </Row>
              ))}
            </DataTable>
          )}
        </PanelBody>
      </Panel>
    </Screen>
  );
}
