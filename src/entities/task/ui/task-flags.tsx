import { Chip, type Tone } from "@/shared/ui/status-dot";
import type { TaskListItem } from "../model/task-types";

/**
 * The attribute chip row (`DEVDOCS/DESIGN.md` §3.6) — the reference's
 * `UDP Support · Unlimited traffic · p0f support` strip, carrying the planner's
 * verdict on a task instead.
 *
 * All four fields are nullable in the spec, and an unset flag renders as absent
 * rather than as `false`: the planner not saying "visual" is not the same as it
 * saying "not visual".
 */

const RISK_TONE: Readonly<Record<string, Tone>> = {
  low: "neutral",
  medium: "warn",
  high: "bad",
};

export function TaskFlags({
  task,
  showDomain = false,
}: {
  task: Pick<TaskListItem, "risk" | "complexity" | "visual" | "agent_able" | "domain">;
  showDomain?: boolean;
}) {
  return (
    <span className="flex flex-wrap items-center gap-1">
      {showDomain && task.domain ? (
        <Chip title="Planner domain">
          <span className="text-muted-foreground">domain</span>
          {task.domain}
        </Chip>
      ) : null}
      {task.risk ? (
        <Chip tone={RISK_TONE[task.risk] ?? "neutral"} title="Planner risk">
          <span className="opacity-70">risk</span>
          {task.risk}
        </Chip>
      ) : null}
      {task.complexity ? (
        <Chip title="Planner complexity">{task.complexity.toUpperCase()}</Chip>
      ) : null}
      {task.visual === true ? <Chip title="Goes through the visual gate">visual</Chip> : null}
      {task.agent_able === false ? (
        <Chip tone="warn" title="The planner marked this as human work">
          human only
        </Chip>
      ) : null}
    </span>
  );
}
