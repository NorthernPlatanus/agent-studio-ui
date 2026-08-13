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
const SHELL = "flex h-full items-center gap-2 ml-1 rounded-lg px-2.5 text-xs transition-colors";

export function ActiveRunPill({ project }: { project: string | null }) {
  const { data } = useSummary(project);
  const run = data?.active_run ?? null;
  // `stale` means the row still says `running` but the process stopped writing
  // long ago (`ops/liveness.py`) — the state two runs in this project's store
  // had been in for eleven days. Ticking an elapsed clock for it, and calling it
  // Running, is the panel repeating a claim it can see is false.
  const isRunning = run?.status === "running" && !run.stale;
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
      title={
        run.stale
          ? `Run ${run.id} still says "running" but has written nothing since ` +
            `${new Date((run.last_activity_at ?? run.started_at) * 1000).toLocaleString()}` +
            " — its process is gone. Reconcile it from Launch."
          : (run.note ?? `Run ${run.id}`)
      }
    >
      <StatusDot tone={run.stale ? "warn" : runStatusTone(run.status)} />
      <span className="font-medium">{run.stale ? "Stalled" : humanize(run.status)}</span>
      {/*
        The run's own short id. Without it this pill is an unattributed "Running"
        that sits one screen away from a Run detail page reporting `Done` for the
        run you are actually looking at — two true statements about two different
        runs, neither of which says which. Hidden below `sm`, where the location
        chip needs the room more.
      */}
      <span className="hidden font-mono text-[11px] text-muted-foreground sm:inline">
        {run.id.slice(-6)}
      </span>
      {isRunning ? (
        <>
          <span className="hidden text-border sm:inline">·</span>
          <span className="hidden tabular-nums text-muted-foreground sm:inline">
            {formatDuration(now - run.started_at)}
          </span>
        </>
      ) : null}
      {tokens === null ? null : (
        <>
          <span className="hidden text-border md:inline">·</span>
          <span
            className="hidden tabular-nums text-muted-foreground md:inline"
            title="Subscription tokens"
          >
            {formatTokens(tokens)} sub
          </span>
        </>
      )}
      {/*
        Below `sm` the pill is a dot and a word, and nothing else — not even the
        cash figure, which §3.3 otherwise calls the one number you always want
        visible. At 375px the bar cannot hold both this and the location chip,
        and the chip is the only thing in the entire app that says which page or
        task you are looking at (§3.3: it "replaces every page `<h1>`"). A
        run's spend is one tap away on the run it belongs to; where you are is
        not recoverable from anything else on screen.
      */}
      <span className="hidden text-border sm:inline">·</span>
      <span className="hidden tabular-nums sm:inline" title="Cash spend on this run">
        {formatUsd(run.cost_usd)}
      </span>
    </Link>
  );
}
