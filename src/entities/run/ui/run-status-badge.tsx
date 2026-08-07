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

export function RunStatusBadge({ status }: { status: string }) {
  return <StatusChip tone={runStatusTone(status)}>{humanize(status)}</StatusChip>;
}
