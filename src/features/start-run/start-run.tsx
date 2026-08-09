/**
 * The commitment step (`DEVDOCS/DESIGN.md` §3.7).
 *
 * Starting a run spawns `python -m orchestrator run …` on the operator's
 * machine: it spends subscription quota and writes to git worktrees. So this is
 * a titled step at the bottom of a sequence, not a modal with a checkbox, and
 * three things are always on screen before the button is reachable:
 *
 *  - **which checkout it will run against**, named — the merged config can make
 *    every project claim a repo, so `runnable_detail` travels with the warning
 *    (`DECISIONS.md` 2026-08-07);
 *  - **that it spends quota**, in as many words;
 *  - **the exact argv**, after the fact, so the job can be followed or
 *    reproduced in a terminal.
 *
 * Dry run is a separate, always-safe button and is deliberately the visually
 * lighter-weight one: it needs no confirmation because it spends nothing.
 */

import { PlayIcon, TerminalIcon } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { describeJobError, type JobAccepted } from "@/entities/job";
import { useStartRun } from "@/entities/job/api";
import type { Project } from "@/entities/project";
import { ApiError } from "@/shared/api/client";
import { formatInteger } from "@/shared/lib/format";
import { Banner } from "@/shared/ui/banner";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { ControlLabel, TextInput } from "@/shared/ui/control";
import { Label } from "@/shared/ui/label";
import { Panel, PanelBody, PanelHeader } from "@/shared/ui/panel";

/** The spawned command line, as the server reports it. */
export function ArgvBanner({ job }: { job: JobAccepted }) {
  return (
    <Banner tone="good">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="font-medium">Started {job.command}.</span>
        {job.run_id ? (
          <Link
            to={`/runs/${encodeURIComponent(job.run_id)}`}
            className="underline underline-offset-2"
          >
            Open run {job.run_id}
          </Link>
        ) : (
          <span className="text-muted-foreground">Watch it in the activity panel.</span>
        )}
      </div>
      <pre className="mt-1.5 flex items-start gap-2 overflow-x-auto rounded bg-foreground/5 px-2 py-1 font-mono text-[11px] text-foreground/80">
        <TerminalIcon className="mt-px size-3 shrink-0" aria-hidden="true" />
        {job.argv.join(" ")}
      </pre>
    </Banner>
  );
}

export function StartRun({
  project,
  detail,
  selected,
  taskCount,
}: {
  project: string | null;
  detail: Project | undefined;
  /** Explicit task ids, or empty to let the scheduler pick. */
  selected: readonly string[];
  /** How many tasks the scheduler would pick when nothing is selected. */
  taskCount: number;
}) {
  const [confirm, setConfirm] = useState(false);
  const [limit, setLimit] = useState("");
  const startRun = useStartRun(project);

  const runnable = detail?.runnable === true;
  const explicit = selected.length > 0;
  const n = limit.trim() === "" ? null : Number(limit);
  const nIsValid = n === null || (Number.isInteger(n) && n > 0);

  const submit = (dryRun: boolean) => {
    startRun.mutate({
      confirm: dryRun ? false : confirm,
      dry_run: dryRun,
      tasks: explicit ? [...selected] : null,
      n: nIsValid ? n : null,
    });
  };

  return (
    <Panel>
      <PanelHeader
        title="Start the run"
        meta={
          explicit
            ? `${formatInteger(selected.length)} selected`
            : `scheduler picks from ${formatInteger(taskCount)} ready`
        }
      />
      <PanelBody className="space-y-3">
        {!runnable ? (
          <Banner tone="bad">
            This project has no checkout, so a run cannot be started.
            <span className="ml-1 text-muted-foreground">{detail?.runnable_detail}</span>
          </Banner>
        ) : detail?.repo_path_source !== "profile" ? (
          <Banner tone="warn">
            The checkout comes from <span className="font-medium">{detail?.repo_path_source}</span>,
            not from this project's own profile — it will run against{" "}
            <span className="font-mono text-xs">{detail?.repo_path}</span>. Check that is the
            working tree you mean.
          </Banner>
        ) : null}

        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <ControlLabel htmlFor="run-n">Task cap (--n)</ControlLabel>
            <TextInput
              id="run-n"
              inputMode="numeric"
              value={limit}
              onChange={(event) => setLimit(event.target.value)}
              placeholder="no cap"
              className="w-28"
            />
          </div>
          <p className="min-w-48 flex-1 text-[12px] text-muted-foreground">
            {explicit
              ? "Only the selected tasks are dispatched."
              : "With nothing selected the scheduler picks the next wave itself."}
          </p>
        </div>

        {!nIsValid ? (
          <Banner tone="warn">The task cap must be a positive whole number.</Banner>
        ) : null}

        <div className="flex items-start gap-2.5 rounded-lg border border-status-warn/35 bg-status-warn/5 px-3.5 py-2.5">
          <Checkbox
            id="run-confirm"
            checked={confirm}
            onCheckedChange={(value) => setConfirm(value === true)}
            disabled={!runnable}
            className="mt-0.5"
          />
          <Label htmlFor="run-confirm" className="text-[13px] font-normal leading-relaxed">
            I understand this <span className="font-medium">spends subscription quota</span> and
            writes to git worktrees in the checkout above.
          </Label>
        </div>

        {startRun.error ? (
          <Banner tone="bad">
            {describeJobError(
              startRun.error instanceof ApiError ? startRun.error.status : 0,
              startRun.error instanceof ApiError ? startRun.error.detail : null,
            )}
          </Banner>
        ) : null}

        {startRun.data ? <ArgvBanner job={startRun.data} /> : null}

        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => submit(false)}
            disabled={!runnable || !confirm || !nIsValid || startRun.isPending}
          >
            <PlayIcon aria-hidden="true" />
            {startRun.isPending ? "Starting…" : "Start run"}
          </Button>
          <Button variant="outline" onClick={() => submit(true)} disabled={startRun.isPending}>
            Dry run
          </Button>
          <span className="text-[12px] text-muted-foreground">
            Dry run prints the schedule and exits — zero tokens, zero git.
          </span>
        </div>
      </PanelBody>
    </Panel>
  );
}
