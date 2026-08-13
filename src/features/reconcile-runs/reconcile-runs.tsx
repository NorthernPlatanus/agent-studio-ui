/**
 * Close out runs whose process died without saying so.
 *
 * The store's run `status` is written by the runner on the two paths that
 * unwind — `done` and `paused`. A killed process writes nothing, so the row
 * keeps its creation-time `running` forever: this project had two such rows,
 * eleven days old, and the panel dutifully reported "Running · 11d 19h" on every
 * screen because that is what the column said.
 *
 * Detection is `RunListItem.stale` (the API compares the run's last events/usage
 * row against `ops/liveness.py`'s window). This is the remedy, and like
 * `import-backlog` it is free: no LLM, no git, no confirmation. It is still a
 * spawned CLI job rather than an API-side update, because the API does not write
 * to the store (PLAN §3.1 rule 2).
 */

import { BrushCleaningIcon } from "lucide-react";
import { describeJobError } from "@/entities/job";
import { useReconcileRuns } from "@/entities/job/api";
import { ApiError } from "@/shared/api/client";
import { Banner } from "@/shared/ui/banner";
import { Button } from "@/shared/ui/button";

export function ReconcileRuns({
  project,
  staleCount = 0,
}: {
  project: string | null;
  /** How many runs the API flagged `stale`, for the button's own count. */
  staleCount?: number;
}) {
  const reconcile = useReconcileRuns(project);

  return (
    <span className="inline-flex flex-col gap-2">
      <Button
        size="sm"
        variant="outline"
        onClick={() => reconcile.mutate()}
        disabled={reconcile.isPending}
        className="self-start"
      >
        <BrushCleaningIcon aria-hidden="true" />
        {reconcile.isPending
          ? "Reconciling…"
          : staleCount > 0
            ? `Close ${staleCount} stalled run${staleCount === 1 ? "" : "s"}`
            : "Reconcile runs"}
      </Button>
      {reconcile.error ? (
        <Banner tone="bad">
          {describeJobError(
            reconcile.error instanceof ApiError ? reconcile.error.status : 0,
            reconcile.error instanceof ApiError ? reconcile.error.detail : null,
          )}
        </Banner>
      ) : null}
      {reconcile.data ? (
        <span className="text-[12px] text-status-good">
          Reconcile started — stalled runs become <span className="font-mono">aborted</span>.
        </span>
      ) : null}
    </span>
  );
}
