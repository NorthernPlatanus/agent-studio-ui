/**
 * Planning: turn `needs_plan` stubs into full specs.
 *
 * Spends tokens, and `confirm` is required by the API — but the checkbox that
 * used to collect it is gone. It gated nothing the button could not gate, and
 * the sentence on it ("Planning spends tokens. Plan every task marked
 * needs_plan.") was a disclaimer wrapped around the one fact worth reading,
 * which is the scope. The scope is now the button's own label, counted.
 *
 * It touches no git worktree, which is why it stays available on a project
 * whose checkout is only inherited.
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
import { ControlLabel, TextInput } from "@/shared/ui/control";
import { Panel, PanelBody, PanelHeader } from "@/shared/ui/panel";

export function PlanTasks({
  project,
  needsPlanCount,
}: {
  project: string | null;
  needsPlanCount: number;
}) {
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

        {/*
          The scope is on the button, not in a sentence beside a checkbox. The
          label used to read "Planning spends tokens. Plan every task marked
          needs_plan." — two facts stapled to a control that gated neither, and
          the second one is the only thing the operator needs at the moment of
          pressing. It is now what the button says, with the count in it.
        */}
        <Button
          variant="outline"
          disabled={startPlan.isPending || needsPlanCount === 0}
          onClick={() =>
            startPlan.mutate({
              // Still affirmed to the API, which requires it — see the panel
              // doc. What is gone is asking the operator to affirm it twice.
              confirm: true,
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
          {startPlan.isPending
            ? "Planning…"
            : `Plan ${formatInteger(needsPlanCount)} task${needsPlanCount === 1 ? "" : "s"}`}
        </Button>
      </PanelBody>
    </Panel>
  );
}
