/**
 * The proposal on the table: what would be written to the backlog if approved.
 *
 * This is the artifact the whole conversation exists to produce, and it is
 * rendered **inside** that conversation — as a card in the log, at the turn the
 * planner produced it (`PlannerTranscript`'s `proposal`).
 *
 * It used to be a panel in a standing column to the right of the chat, with the
 * approve/revise/discard bar in its own footer. The adjacency argument for that
 * is real (`DESIGN.md` §3.4, tier 2) and it lost to a plainer one: the panel
 * scrolled, so past two or three specs the irreversible button was off the
 * bottom of a pane, and the column it lived in was suppressed entirely below
 * `@3xl`. A control that is sometimes not on the screen is worse than a control
 * one line further away. The decision is pinned in the page's action zone now,
 * which the specs always sit directly above.
 *
 * `footer` survives for anything that genuinely belongs under the list and
 * inside this border. Nothing currently uses it.
 *
 * What is shown per spec is chosen for the question an operator is actually
 * answering — "is this safe to hand to an agent?":
 *
 *  - `files_write` is the worker's entire write allowlist, so it *is* the blast
 *    radius. An empty or missing one is a spec that can never go green.
 *  - `agent_able: false` means no worker will ever touch it — a human-only row
 *    landing in the backlog is a different decision from an agent task.
 *  - `deps` decide which wave it lands in, and a wrong dep is how a task runs
 *    against a tree that does not have its prerequisite yet.
 *  - `n_candidates` multiplies spend for that task.
 */

import type { ProposedSpec } from "@/entities/discuss";
import { formatInteger } from "@/shared/lib/format";
import { Banner } from "@/shared/ui/banner";
import { FilePath } from "@/shared/ui/file-path";
import { Markdown } from "@/shared/ui/markdown";
import { Panel, PanelBody, PanelFooter, PanelHeader } from "@/shared/ui/panel";
import { Chip } from "@/shared/ui/status-dot";

function str(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

function list(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function SpecCard({ spec }: { spec: ProposedSpec }) {
  const id = str(spec.id) ?? "?";
  const writes = list(spec.files_write);
  const reads = list(spec.files_read);
  const deps = list(spec.deps);
  const agentAble = spec.agent_able !== false;
  const candidates = typeof spec.n_candidates === "number" ? spec.n_candidates : null;

  return (
    <li className="space-y-2 rounded-lg border border-border px-3.5 py-3">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="font-mono text-xs text-muted-foreground">{id}</span>
        <span className="min-w-0 flex-1 text-[13px] font-medium">{str(spec.title) ?? "—"}</span>
      </div>

      <div className="flex flex-wrap gap-1">
        {str(spec.domain) ? <Chip>domain {spec.domain as string}</Chip> : null}
        {str(spec.risk) ? (
          <Chip tone={spec.risk === "high" ? "bad" : spec.risk === "medium" ? "warn" : "neutral"}>
            risk {spec.risk as string}
          </Chip>
        ) : null}
        {/* Labelled, like its neighbours: `complexity` is one of s/m/l, and bare
            it was a single stray letter between two labelled chips. */}
        {str(spec.complexity) ? <Chip>size {spec.complexity as string}</Chip> : null}
        {spec.visual === true ? <Chip tone="progress">visual</Chip> : null}
        {agentAble ? null : <Chip tone="warn">human-only</Chip>}
        {candidates !== null && candidates > 1 ? (
          <Chip tone="progress" title="Best-of-N: this many LLM attempts for this one task">
            n={candidates}
          </Chip>
        ) : null}
        {deps.length > 0 ? <Chip title={deps.join(", ")}>{deps.length} dep</Chip> : null}
      </div>

      {/* The spec body is the longest planner-written prose on the screen and
          the densest in code spans — it names the files, the fields and the
          call sites the worker will touch. It was rendered raw, so a
          three-paragraph description arrived as one run-on block with its
          backticks and its numbered steps showing. */}
      {str(spec.description) ? (
        <Markdown
          text={spec.description as string}
          className="text-[12px] leading-relaxed text-muted-foreground"
        />
      ) : null}

      {/* The write allowlist is the one field worth reading every time. */}
      {agentAble && writes.length === 0 ? (
        <Banner tone="bad">
          No <span className="font-mono text-xs">files_write</span> — an agent task with no write
          allowlist is rejected at plan time and can never go green.
        </Banner>
      ) : writes.length > 0 ? (
        <div className="space-y-0.5">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            writes
          </span>
          {writes.map((path) => (
            <FilePath key={path} path={path} />
          ))}
        </div>
      ) : null}

      {reads.length > 0 ? (
        <details className="text-[12px]">
          <summary className="text-muted-foreground">
            reads {formatInteger(reads.length)} file{reads.length === 1 ? "" : "s"}
          </summary>
          <div className="mt-1 space-y-0.5">
            {reads.map((path) => (
              <FilePath key={path} path={path} />
            ))}
          </div>
        </details>
      ) : null}
    </li>
  );
}

export function SpecArtifacts({
  specs,
  title = "Proposed specs",
  footer,
  note,
}: {
  specs: readonly ProposedSpec[];
  title?: string;
  /** Anything that belongs under the list and inside this panel's border. Not
   *  the decision bar — see below. */
  footer?: React.ReactNode;
  note?: React.ReactNode;
}) {
  const attempts = specs.reduce(
    (sum, spec) => sum + (typeof spec.n_candidates === "number" ? spec.n_candidates : 1),
    0,
  );

  return (
    <Panel>
      <PanelHeader
        title={title}
        meta={`${formatInteger(specs.length)} task${specs.length === 1 ? "" : "s"} · ${formatInteger(attempts)} candidate attempt${attempts === 1 ? "" : "s"} if run`}
      />
      <PanelBody className="space-y-3">
        {note}
        <ul className="space-y-2">
          {specs.map((spec, index) => (
            <SpecCard key={str(spec.id) ?? index} spec={spec} />
          ))}
        </ul>
      </PanelBody>
      {footer ? <PanelFooter>{footer}</PanelFooter> : null}
    </Panel>
  );
}
