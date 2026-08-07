/**
 * The run pill — the reference's `$15` balance chip, translated
 * (`DEVDOCS/DESIGN.md` §3.3).
 *
 * This is the one fact an operator wants visible on every screen: *is something
 * running, and what has it spent*. It sits in a fixed position in the chrome so
 * the answer is always in the same place, and it links to the run it describes.
 *
 * Both channels are shown and neither is summed: subscription tokens are the
 * quota proxy, cash is money (CONTRACT §3). Adding them would produce a figure
 * that means nothing.
 */

import { Link } from "react-router";
import { useSummary } from "@/entities/project/api";
import { runStatusTone } from "@/entities/run/ui";
import { useNow } from "@/shared/hooks";
import { formatDuration, formatTokens, formatUsd, humanize } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";
import { StatusDot } from "@/shared/ui/status-dot";

/**
 * Borderless: the top bar nests this inside a shared pill alongside the stream
 * indicator, so the group owns the border and this owns only its content (§3.3).
 */
const SHELL = "flex h-full items-center gap-2 rounded-lg px-2.5 text-xs transition-colors";

export function ActiveRunPill({ project }: { project: string | null }) {
  const { data } = useSummary(project);
  const run = data?.active_run ?? null;
  const isRunning = run?.status === "running";
  const now = useNow(isRunning);

  if (!run) {
    return (
      <span className={cn(SHELL, "text-muted-foreground")} title="No run in progress">
        <StatusDot tone="neutral" pulse={false} />
        Idle
      </span>
    );
  }

  const subscription = run.tokens.subscription;
  const tokens =
    subscription === null || subscription === undefined
      ? null
      : subscription.in_tok + subscription.out_tok;

  return (
    <Link
      to={`/runs/${encodeURIComponent(run.id)}`}
      className={cn(SHELL, "hover:bg-accent hover:text-accent-foreground")}
      title={run.note ?? `Run ${run.id}`}
    >
      <StatusDot tone={runStatusTone(run.status)} />
      <span className="font-medium">{humanize(run.status)}</span>
      {isRunning ? (
        <>
          <span className="text-border">·</span>
          <span className="tabular-nums text-muted-foreground">
            {formatDuration(now - run.started_at)}
          </span>
        </>
      ) : null}
      {tokens === null ? null : (
        <>
          <span className="text-border">·</span>
          <span className="tabular-nums text-muted-foreground" title="Subscription tokens">
            {formatTokens(tokens)} sub
          </span>
        </>
      )}
      <span className="text-border">·</span>
      <span className="tabular-nums" title="Cash spend on this run">
        {formatUsd(run.cost_usd)}
      </span>
    </Link>
  );
}
