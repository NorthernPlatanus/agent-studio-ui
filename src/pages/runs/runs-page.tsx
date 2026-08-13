/**
 * Run history.
 *
 * Both channels get their own column and are never added together: the cash
 * column is money spent, the subscription column is quota consumed
 * (CONTRACT §3).
 */

import { Link } from "react-router";
import { RunStatusBadge } from "@/entities/run";
import { useRuns } from "@/entities/run/api";
import { useActiveProject } from "@/features/project-switch";
import { ApiError } from "@/shared/api/client";
import {
  formatInteger,
  formatTimestamp,
  formatTokens,
  formatUsd,
  textOrDash,
} from "@/shared/lib/format";
import { Banner } from "@/shared/ui/banner";
import { Cell, type Column, DataTable, Row } from "@/shared/ui/data-table";
import { EmptyState, Region } from "@/shared/ui/region";
import { Screen } from "@/shared/ui/screen";
import { Skeleton } from "@/shared/ui/skeleton";

const STATUS: Column = { key: "status", header: "Status", width: "7.5rem" };
const RUN: Column = { key: "run", header: "Run", width: "13rem" };
const STARTED: Column = { key: "started", header: "Started", width: "11rem", hideBelow: "sm" };
const SUBSCRIPTION: Column = {
  key: "subscription",
  header: "Subscription",
  width: "8rem",
  align: "right",
};
const CASH: Column = { key: "cash", header: "Cash", width: "6.5rem", align: "right" };
const NOTE: Column = { key: "note", header: "Note", hideBelow: "md" };

const COLUMNS = [STATUS, RUN, STARTED, SUBSCRIPTION, CASH, NOTE];

export function RunsPage() {
  const { project } = useActiveProject();
  const { data, isPending, error } = useRuns(project);

  if (error) {
    return (
      <Screen>
        {error instanceof ApiError && error.status === 409 ? (
          <Banner tone="info">This project has no store yet — no runs to show.</Banner>
        ) : (
          <Banner tone="bad">Could not read the run list.</Banner>
        )}
      </Screen>
    );
  }

  return (
    <Screen rhythm="tight">
      <Region title="Runs" meta={data ? formatInteger(data.runs.length) : undefined}>
        {isPending ? (
          <div className="space-y-1.5">
            {[0, 1, 2].map((row) => (
              <Skeleton key={row} className="h-9 w-full" />
            ))}
          </div>
        ) : data.runs.length === 0 ? (
          <EmptyState>No runs recorded for this project.</EmptyState>
        ) : (
          <DataTable columns={COLUMNS} minWidth="40rem">
            {data.runs.map((run) => {
              const subscription = run.tokens.subscription;
              return (
                <Row key={run.id} interactive>
                  <Cell column={STATUS}>
                    <RunStatusBadge status={run.status} stale={run.stale} />
                  </Cell>
                  <Cell column={RUN}>
                    <Link
                      to={`/runs/${encodeURIComponent(run.id)}`}
                      className="font-mono text-xs underline-offset-2 hover:underline"
                    >
                      {run.id}
                    </Link>
                  </Cell>
                  <Cell column={STARTED} className="text-muted-foreground">
                    {formatTimestamp(run.started_at)}
                  </Cell>
                  <Cell column={SUBSCRIPTION} numeric>
                    {subscription
                      ? `${formatTokens(subscription.in_tok + subscription.out_tok)} tok`
                      : "—"}
                  </Cell>
                  <Cell column={CASH} numeric>
                    {formatUsd(run.cost_usd)}
                  </Cell>
                  <Cell column={NOTE} className="text-muted-foreground">
                    <span title={run.note ?? undefined}>{textOrDash(run.note)}</span>
                  </Cell>
                </Row>
              );
            })}
          </DataTable>
        )}
      </Region>
    </Screen>
  );
}
