/**
 * The orchestrator's pipeline, with the exception counters hung off the stages
 * that produce them.
 *
 * The stage *sequence* is structural knowledge — it is the graph in
 * `engine/graph.py`, not something the store reports — so it is drawn from a
 * constant. What the store does supply is `event_counts`, and each counter is
 * attached to the stage it comes out of rather than being dumped in a row of
 * badges: `no_patch` is a candidate-stage fact, `escalated` is a review-stage
 * fact, and putting them side by side loses that.
 *
 * Per-stage *task* counts are not in the API — there is no "which stage is this
 * task in" column — so the live occupancy readout is plugged rather than faked.
 */

import { Link } from "react-router";
import { formatInteger } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";
import { Soon } from "@/shared/ui/soon";
import { Chip } from "@/shared/ui/status-dot";

interface Stage {
  key: string;
  label: string;
  /** `event_counts` keys whose exceptions originate at this stage. */
  exceptions?: Array<{ kind: string; label: string }>;
}

const STAGES: Stage[] = [
  { key: "plan", label: "Plan" },
  { key: "wave", label: "Wave" },
  {
    key: "dispatch",
    label: "Dispatch",
    exceptions: [
      { kind: "retrieval_exhausted", label: "retrieval exhausted" },
      { kind: "crashed", label: "crashed" },
    ],
  },
  {
    key: "candidates",
    label: "Candidates",
    exceptions: [{ kind: "no_patch", label: "no patch" }],
  },
  { key: "gate", label: "Gate" },
  {
    key: "visual",
    label: "Visual gate",
    exceptions: [
      { kind: "visual_gate_error", label: "errored" },
      { kind: "visual_gate_skipped", label: "skipped" },
    ],
  },
  {
    key: "review",
    label: "Review",
    exceptions: [
      { kind: "escalated", label: "escalated" },
      { kind: "verify_unverifiable", label: "unverifiable" },
    ],
  },
  { key: "integrate", label: "Integrate" },
  { key: "finalize", label: "Finalize" },
];

export function StagePipeline({ eventCounts }: { eventCounts: Readonly<Record<string, number>> }) {
  return (
    <div className="space-y-3">
      {/*
        Scrolls; never wraps. The chevrons are the whole point of this widget —
        it exists to show a sequence in sequence order — and wrapping breaks that
        premise silently: at 1280×800 with the activity rail in its documented
        default-open state, `Finalize` landed alone on a second row with no
        connector into it, reading as detached rather than terminal. A strip that
        runs off the edge still reads as a strip.
      */}
      <ol className="-mx-1 flex items-stretch gap-1.5 overflow-x-auto px-1 pb-1">
        {STAGES.map((stage, index) => {
          const problems = (stage.exceptions ?? []).filter(
            (exception) => (eventCounts[exception.kind] ?? 0) > 0,
          );
          return (
            <li key={stage.key} className="flex shrink-0 items-stretch gap-1.5">
              <div
                className={cn(
                  "flex flex-col justify-center rounded-lg border px-2.5 py-1.5",
                  problems.length > 0 ? "border-status-warn/40 bg-status-warn/5" : "border-border",
                )}
              >
                <span className="text-[12px] font-medium leading-tight">{stage.label}</span>
                {problems.length > 0 ? (
                  <span className="mt-1 flex flex-wrap gap-1">
                    {problems.map((problem) => (
                      <Link key={problem.kind} to={`/runs`} className="focus-visible:outline-none">
                        <Chip tone="warn" title={`${problem.kind} events`}>
                          {formatInteger(eventCounts[problem.kind] ?? 0)} {problem.label}
                        </Chip>
                      </Link>
                    ))}
                  </span>
                ) : null}
              </div>
              {index < STAGES.length - 1 ? (
                <span className="self-center text-border" aria-hidden="true">
                  ›
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>

      <p className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <Soon />
        Live occupancy per stage needs a stage field on the task row; today the store records stage
        transitions only as events.
      </p>
    </div>
  );
}
