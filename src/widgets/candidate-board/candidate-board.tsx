/**
 * Per-candidate attempts for one task.
 *
 * The board must render all three values of `source` distinctly (CONTRACT §4),
 * because they mean genuinely different things:
 *  - `checkpoint` — live and complete, this is what a running task looks like;
 *  - `events` — history, where `null` branch/worktree/notes mean "not retained",
 *    **not** "failed";
 *  - `none` — nothing ran, or the checkpoint was pruned. An empty state, not an
 *    error.
 *
 * The full diff and per-candidate messages are deliberately absent from the
 * response; `has_diff` answers the only question this board asks.
 */

import {
  type Candidate,
  candidateTone,
  isInFlight,
  SOURCE_EXPLANATION,
  SOURCE_LABEL,
} from "@/entities/candidate";
import { useTaskCandidates } from "@/entities/candidate/api";
import { humanize, textOrDash } from "@/shared/lib/format";
import { Banner } from "@/shared/ui/banner";
import { Field } from "@/shared/ui/metric";
import { Panel, PanelBody, PanelHeader } from "@/shared/ui/panel";
import { EmptyState } from "@/shared/ui/region";
import { Skeleton } from "@/shared/ui/skeleton";
import { Chip, StatusChip } from "@/shared/ui/status-dot";

function CandidateCard({ candidate }: { candidate: Candidate }) {
  const tone = candidateTone(candidate);
  return (
    <Panel>
      <PanelHeader
        title={<span className="font-mono text-[13px]">{candidate.cand_id}</span>}
        meta={`attempt ${candidate.attempt}`}
        actions={
          <StatusChip tone={tone}>
            {isInFlight(candidate) ? "running" : humanize(candidate.status ?? "unknown")}
          </StatusChip>
        }
      />
      <PanelBody className="space-y-3 py-3">
        <div className="flex flex-wrap gap-1">
          {candidate.model ? <Chip title="Worker model">{candidate.model}</Chip> : null}
          {candidate.has_diff ? <Chip tone="good">has diff</Chip> : null}
          {candidate.no_patch ? <Chip tone="bad">no patch</Chip> : null}
        </div>

        <dl className="divide-y divide-border/50">
          <Field label="Branch">
            <span className="font-mono text-xs">{textOrDash(candidate.branch)}</span>
          </Field>
          <Field label="Worktree">
            <span className="truncate font-mono text-xs">{textOrDash(candidate.worktree)}</span>
          </Field>
          {candidate.error ? (
            <Field label="Error">
              <span className="text-status-bad">{candidate.error}</span>
            </Field>
          ) : null}
          {candidate.notes ? <Field label="Notes">{candidate.notes}</Field> : null}
        </dl>

        {candidate.gate_log ? (
          <details>
            <summary className="cursor-pointer text-[12px] text-muted-foreground hover:text-foreground">
              Gate log (tail)
            </summary>
            <pre className="mt-1.5 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted/50 p-2 text-xs leading-relaxed">
              {candidate.gate_log}
            </pre>
          </details>
        ) : null}
      </PanelBody>
    </Panel>
  );
}

export function CandidateBoard({
  project,
  taskId,
}: {
  project: string | null;
  taskId: string | undefined;
}) {
  const { data, isPending, error } = useTaskCandidates(project, taskId);

  if (error) return <Banner tone="bad">Could not read candidates for this task.</Banner>;
  if (isPending) return <Skeleton className="h-32 w-full" />;
  if (data.source === "none" || data.candidates.length === 0) {
    return <EmptyState>{SOURCE_EXPLANATION.none}</EmptyState>;
  }

  return (
    <div className="space-y-2.5">
      <p className="text-[12px] text-muted-foreground">
        <span className="font-medium text-foreground">{SOURCE_LABEL[data.source]}</span>{" "}
        {SOURCE_EXPLANATION[data.source]}
      </p>
      <div className="grid gap-3 @4xl:grid-cols-2">
        {data.candidates.map((candidate) => (
          <CandidateCard key={`${candidate.cand_id}-${candidate.attempt}`} candidate={candidate} />
        ))}
      </div>
    </div>
  );
}
