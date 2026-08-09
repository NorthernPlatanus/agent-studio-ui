/**
 * The zero-token schedule preview: what a run *would* do.
 *
 * This is computed in-process from `engine.scheduler` — no tokens, no git — so
 * it is the safe affordance and the panel makes it the default one. Two
 * warnings ride along with it because they are planner mistakes rather than
 * scheduler facts, and catching them before a run is the whole point:
 * `unreachable` (ready tasks no wave can reach, i.e. unmet deps) and
 * `seam_missing_deps` (seam-domain tasks with no deps at all).
 *
 * Files each task writes are shown per wave because two tasks in the same wave
 * writing the same file is the collision the wave planner exists to avoid, and
 * a human can spot it here for free.
 */

import type { components } from "@/shared/api/generated";
import { formatInteger } from "@/shared/lib/format";
import { Banner } from "@/shared/ui/banner";
import { Panel, PanelBody, PanelHeader } from "@/shared/ui/panel";
import { EmptyState } from "@/shared/ui/region";
import { Chip } from "@/shared/ui/status-dot";

type Waves = components["schemas"]["Waves"];
type Wave = components["schemas"]["Wave"];

/** Files written by more than one task in the same wave. */
function collisions(wave: Wave): Set<string> {
  const seen = new Map<string, number>();
  for (const task of wave.tasks) {
    for (const file of task.files_write ?? []) {
      seen.set(file, (seen.get(file) ?? 0) + 1);
    }
  }
  return new Set([...seen].filter(([, count]) => count > 1).map(([file]) => file));
}

export function WavePlan({ waves, selected }: { waves: Waves; selected?: ReadonlySet<string> }) {
  const shown =
    selected === undefined || selected.size === 0
      ? waves.waves
      : waves.waves
          .map((wave) => ({ ...wave, tasks: wave.tasks.filter((task) => selected.has(task.id)) }))
          .filter((wave) => wave.tasks.length > 0);

  const taskCount = shown.reduce((sum, wave) => sum + wave.tasks.length, 0);
  const candidateCount = shown.reduce(
    (sum, wave) => sum + wave.tasks.reduce((inner, task) => inner + task.n_candidates, 0),
    0,
  );

  if (taskCount === 0) {
    return (
      <EmptyState>
        Nothing is schedulable right now — no ready task has all of its dependencies met.
      </EmptyState>
    );
  }

  return (
    <div className="space-y-3">
      {/* Tier 2: the estimate belongs next to the plan it was computed from. */}
      <Banner tone="info">
        {formatInteger(shown.length)} wave{shown.length === 1 ? "" : "s"} ·{" "}
        {formatInteger(taskCount)} task{taskCount === 1 ? "" : "s"} ·{" "}
        {formatInteger(candidateCount)} candidate attempt{candidateCount === 1 ? "" : "s"} ·{" "}
        {formatInteger(waves.max_parallel_tasks)} in parallel.{" "}
        <span className="text-muted-foreground">
          Costed per attempt, not per task — this is the figure that spends quota.
        </span>
      </Banner>

      {(waves.unreachable ?? []).length > 0 ? (
        <Banner tone="warn">
          <span className="font-medium">Unreachable this run:</span>{" "}
          {(waves.unreachable ?? []).join(", ")} — ready, but their dependencies are not done.
        </Banner>
      ) : null}

      {(waves.seam_missing_deps ?? []).length > 0 ? (
        <Banner tone="warn">
          <span className="font-medium">Seam tasks with no dependencies:</span>{" "}
          {(waves.seam_missing_deps ?? []).join(", ")} — almost always a planner mistake, since a
          seam task exists to join work that came before it.
        </Banner>
      ) : null}

      {shown.map((wave) => {
        const clashing = collisions(wave);
        return (
          <Panel key={wave.index}>
            <PanelHeader
              title={`Wave ${wave.index}`}
              meta={`${wave.tasks.length} task${wave.tasks.length === 1 ? "" : "s"}`}
              actions={
                clashing.size > 0 ? (
                  <Chip tone="bad" title={[...clashing].join(", ")}>
                    write collision
                  </Chip>
                ) : null
              }
            />
            <PanelBody className="space-y-2 py-3">
              {wave.tasks.map((task) => (
                <div key={task.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">
                    {task.id}
                  </span>
                  <span className="min-w-0 flex-1 text-[13px]">{task.title}</span>
                  <span className="flex shrink-0 flex-wrap gap-1">
                    {task.domain ? <Chip>{task.domain}</Chip> : null}
                    <Chip
                      tone={task.n_candidates > 1 ? "progress" : "neutral"}
                      title={task.candidates.join(", ")}
                    >
                      {task.n_candidates}×
                    </Chip>
                    {(task.files_write ?? []).map((file) => (
                      <Chip key={file} tone={clashing.has(file) ? "bad" : "neutral"} title={file}>
                        <span className="max-w-40 truncate font-mono">{file}</span>
                      </Chip>
                    ))}
                  </span>
                </div>
              ))}
            </PanelBody>
          </Panel>
        );
      })}
    </div>
  );
}
