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
import { useActiveProject } from "@/features/project-switch/use-active-project";
import { ApiError } from "@/shared/api/client";
import { formatTimestamp, formatTokens, formatUsd, textOrDash } from "@/shared/lib/format";
import { Banner } from "@/shared/ui/banner";
import { EmptyState, Region } from "@/shared/ui/region";
import { Skeleton } from "@/shared/ui/skeleton";

const TH =
  "h-8 px-3 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground";
const TD = "px-3 py-2 align-middle";

export function RunsPage() {
  const { project } = useActiveProject();
  const { data, isPending, error } = useRuns(project);

  if (error) {
    return (
      <div className="pt-2">
        {error instanceof ApiError && error.status === 409 ? (
          <Banner tone="info">This project has no store yet — no runs to show.</Banner>
        ) : (
          <Banner tone="bad">Could not read the run list.</Banner>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3 pt-1">
      <Region title="Runs" meta={data ? `${data.runs.length}` : undefined}>
        {isPending ? (
          <div className="space-y-1.5">
            {[0, 1, 2].map((row) => (
              <Skeleton key={row} className="h-10 w-full" />
            ))}
          </div>
        ) : data.runs.length === 0 ? (
          <EmptyState>No runs recorded for this project.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[48rem] border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-border">
                  <th className={TH}>Status</th>
                  <th className={TH}>Run</th>
                  <th className={TH}>Started</th>
                  <th className={`${TH} text-right`}>Subscription</th>
                  <th className={`${TH} text-right`}>Cash</th>
                  <th className={TH}>Note</th>
                </tr>
              </thead>
              <tbody>
                {data.runs.map((run) => {
                  const subscription = run.tokens.subscription;
                  return (
                    <tr
                      key={run.id}
                      className="border-b border-border/50 transition-colors hover:bg-foreground/[0.03]"
                    >
                      <td className={TD}>
                        <RunStatusBadge status={run.status} />
                      </td>
                      <td className={TD}>
                        <Link
                          to={`/runs/${encodeURIComponent(run.id)}`}
                          className="font-mono text-xs underline-offset-2 hover:underline"
                        >
                          {run.id}
                        </Link>
                      </td>
                      <td className={`${TD} text-muted-foreground`}>
                        {formatTimestamp(run.started_at)}
                      </td>
                      <td className={`${TD} text-right tabular-nums`}>
                        {subscription
                          ? `${formatTokens(subscription.in_tok + subscription.out_tok)} tok`
                          : "—"}
                      </td>
                      <td className={`${TD} text-right tabular-nums`}>{formatUsd(run.cost_usd)}</td>
                      <td
                        className={`${TD} max-w-72 truncate text-muted-foreground`}
                        title={run.note ?? undefined}
                      >
                        {textOrDash(run.note)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Region>
    </div>
  );
}
