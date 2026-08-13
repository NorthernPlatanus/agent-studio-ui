/**
 * The proposal on the table: what would be written to the backlog if approved.
 *
 * This is the artifact the whole conversation exists to produce, so it is not a
 * line in the transcript — it is a panel that stays put while the chat scrolls,
 * with the approve/edit/abort bar attached to it rather than to the composer.
 * The decision is about *these specs*, and the control belongs next to what it
 * acts on (`DESIGN.md` §3.4, tier 2: computed feedback sits adjacent to the
 * inputs that produce it).
 *
 * That was the intent from the start and the code did not honour it: the panel
 * took an `actions` prop no caller ever passed, while the real decision bar sat
 * in the composer, outside this panel's border and — once a session had a few
 * turns on it — off the bottom of a 900px window. So the warning that said
 * "approving upserts every spec below" was adjacent to nothing, and the
 * irreversible click was somewhere you had to go looking for it. `footer` is
 * that prop made real, rendered under the specs it decides.
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
        {str(spec.complexity) ? <Chip>{spec.complexity as string}</Chip> : null}
        {spec.visual === true ? <Chip tone="progress">visual</Chip> : null}
        {agentAble ? null : <Chip tone="warn">human-only</Chip>}
        {candidates !== null && candidates > 1 ? (
          <Chip tone="progress" title="Best-of-N: this many LLM attempts for this one task">
            n={candidates}
          </Chip>
        ) : null}
        {deps.length > 0 ? <Chip title={deps.join(", ")}>{deps.length} dep</Chip> : null}
      </div>

      {str(spec.description) ? (
        <p className="text-[12px] leading-relaxed text-muted-foreground">
          {spec.description as string}
        </p>
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
          <summary className="cursor-pointer text-muted-foreground">
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
  fill = false,
}: {
  specs: readonly ProposedSpec[];
  title?: string;
  /** The decision bar. Rendered under the list, inside this panel's border. */
  footer?: React.ReactNode;
  note?: React.ReactNode;
  /**
   * Take the column's slack and scroll the list internally, so the footer stays
   * pinned. Without it a proposal of more than two or three specs pushes its own
   * approve button off the bottom of the pane — the same defect as before, moved
   * eight inches to the right.
   */
  fill?: boolean;
}) {
  const attempts = specs.reduce(
    (sum, spec) => sum + (typeof spec.n_candidates === "number" ? spec.n_candidates : 1),
    0,
  );

  return (
    <Panel fill={fill}>
      <PanelHeader
        title={title}
        meta={`${formatInteger(specs.length)} task${specs.length === 1 ? "" : "s"} · ${formatInteger(attempts)} candidate attempt${attempts === 1 ? "" : "s"} if run`}
      />
      <PanelBody scroll={fill} className="space-y-3">
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
