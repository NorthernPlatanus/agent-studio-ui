import { humanize } from "@/shared/lib/format";
import { StatusChip, type Tone } from "@/shared/ui/status-dot";

const TONE: Readonly<Record<string, Tone>> = {
  running: "progress",
  paused: "warn",
  done: "good",
  aborted: "bad",
};

export function runStatusTone(status: string): Tone {
  return TONE[status] ?? "neutral";
}

/**
 * `stale` is not a fifth status — it is the API's judgement that the recorded
 * one has expired. A run whose process was killed keeps `running` forever
 * (`ops/liveness.py`), so rendering the column verbatim means the panel repeats
 * a claim the server has already told it is false. "Stalled" is what it is.
 */
export function RunStatusBadge({ status, stale = false }: { status: string; stale?: boolean }) {
  if (stale) {
    return (
      <StatusChip
        tone="warn"
        title="No events or LLM calls for a long time — the process is gone. Reconcile it from Launch."
      >
        Stalled
      </StatusChip>
    );
  }
  return <StatusChip tone={runStatusTone(status)}>{humanize(status)}</StatusChip>;
}
