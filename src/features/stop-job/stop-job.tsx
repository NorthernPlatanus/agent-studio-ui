/**
 * Stop a running job.
 *
 * SIGINT → grace → SIGTERM → SIGKILL, awaited server-side. Stopping is safe in
 * the sense that matters: the run's checkpoint survives, so the work is
 * resumable rather than lost. That is worth saying on the control, because
 * "stop" on something that has been spending quota for twenty minutes otherwise
 * reads as destructive.
 */

import { SquareIcon } from "lucide-react";
import { useState } from "react";
import { useStopJob } from "@/entities/job/api";
import { Button } from "@/shared/ui/button";

export function StopJob({ project, jobId }: { project: string | null; jobId: string }) {
  const [armed, setArmed] = useState(false);
  const stop = useStopJob(project);

  if (armed) {
    return (
      <span className="inline-flex items-center gap-1">
        <Button
          size="xs"
          variant="destructive"
          onClick={() => stop.mutate(jobId)}
          disabled={stop.isPending}
          title="The run stays resumable from its checkpoint"
        >
          {stop.isPending ? "Stopping…" : "Confirm stop"}
        </Button>
        <Button size="xs" variant="ghost" onClick={() => setArmed(false)}>
          Cancel
        </Button>
      </span>
    );
  }

  return (
    <Button
      size="xs"
      variant="ghost"
      onClick={() => setArmed(true)}
      title="Signals the process; the run stays resumable"
    >
      <SquareIcon aria-hidden="true" />
      Stop
    </Button>
  );
}
