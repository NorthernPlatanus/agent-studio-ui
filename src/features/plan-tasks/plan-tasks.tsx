/**
 * Planning: turn `needs_plan` stubs into full specs.
 *
 * Spends tokens, so it is confirm-gated like a run — but it touches no git
 * worktree, which is why it stays available on a project whose checkout is only
 * inherited, and why its warning is quieter than the run's.
 *
 * The note is the planner's positional argument: a free-text steer. It is
 * validated server-side to a shape argparse cannot read as a flag.
 */

import { NotebookPenIcon } from "lucide-react";
import { useState } from "react";
import { describeJobError } from "@/entities/job";
import { useStartPlan } from "@/entities/job/api";
import { ApiError } from "@/shared/api/client";
import { formatInteger } from "@/shared/lib/format";
import { Banner } from "@/shared/ui/banner";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { ControlLabel, TextInput } from "@/shared/ui/control";
import { Label } from "@/shared/ui/label";
import { Panel, PanelBody, PanelHeader } from "@/shared/ui/panel";

export function PlanTasks({
  project,
  needsPlanCount,
}: {
  project: string | null;
  needsPlanCount: number;
}) {
  const [confirm, setConfirm] = useState(false);
  const [note, setNote] = useState("");
  const startPlan = useStartPlan(project);

  return (
    <Panel>
      <PanelHeader title="Plan tasks" meta={`${formatInteger(needsPlanCount)} need a plan`} />
      <PanelBody className="space-y-3">
        <div className="space-y-1.5">
          <ControlLabel htmlFor="plan-note">Steer (optional)</ControlLabel>
          <TextInput
            id="plan-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="e.g. keep each task under a day of work"
            className="w-full"
          />
        </div>

        <div className="flex items-start gap-2.5">
          <Checkbox
            id="plan-confirm"
            checked={confirm}
            onCheckedChange={(value) => setConfirm(value === true)}
            className="mt-0.5"
          />
          <Label htmlFor="plan-confirm" className="text-[13px] font-normal leading-relaxed">
            Planning spends tokens. Plan every task marked needs_plan.
          </Label>
        </div>

        {startPlan.error ? (
          <Banner tone="bad">
            {describeJobError(
              startPlan.error instanceof ApiError ? startPlan.error.status : 0,
              startPlan.error instanceof ApiError ? startPlan.error.detail : null,
            )}
          </Banner>
        ) : null}

        {startPlan.data ? (
          <Banner tone="good">
            Planning started.
            <pre className="mt-1.5 overflow-x-auto rounded bg-foreground/5 px-2 py-1 font-mono text-[11px] text-foreground/80">
              {startPlan.data.argv.join(" ")}
            </pre>
          </Banner>
        ) : null}

        <Button
          variant="outline"
          disabled={!confirm || startPlan.isPending || needsPlanCount === 0}
          onClick={() =>
            startPlan.mutate({
              confirm,
              // Scoped by status, never by id. The panel has no `needs_plan`
              // picker, and the only selection on this page is Launch's, whose
              // tasks are `ready` — already planned.
              tasks: null,
              all_needs_plan: true,
              limit: null,
              note: note.trim(),
            })
          }
        >
          <NotebookPenIcon aria-hidden="true" />
          {startPlan.isPending ? "Planning…" : "Plan"}
        </Button>
      </PanelBody>
    </Panel>
  );
}
