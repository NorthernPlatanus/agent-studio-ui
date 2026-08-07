import { humanize } from "@/shared/lib/format";
import { StatusChip } from "@/shared/ui/status-dot";
import { taskStatusTone } from "../model/task-types";

/**
 * Status chip. Tone carries meaning, so it never carries it *alone* — the label
 * is always the status text (a11y: colour is not the only channel).
 */
export function TaskStatusBadge({ status }: { status: string }) {
  return <StatusChip tone={taskStatusTone(status)}>{humanize(status)}</StatusChip>;
}
