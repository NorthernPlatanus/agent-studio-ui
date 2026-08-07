/**
 * Settings — read-only, by design. Configuration lives in the orchestrator's
 * YAML and the panel must not become a second place it can be changed.
 *
 * `repo_path_source` is shown next to the path because the merged config can
 * make *every* project claim a checkout: the operator's `config/local.yaml` sets
 * one machine-global `project.repo_path`, so a project whose own profile says
 * `null` still reports runnable (`DECISIONS.md` 2026-08-07). A panel that hides
 * that provenance would happily offer to run one project against another's
 * working tree.
 */

import { useProjects } from "@/entities/project/api";
import { useActiveProject } from "@/features/project-switch/use-active-project";
import { env } from "@/shared/config/env";
import { formatInteger } from "@/shared/lib/format";
import { useUiStore } from "@/shared/store/ui-store";
import { Banner } from "@/shared/ui/banner";
import { Field } from "@/shared/ui/metric";
import { Panel, PanelBody, PanelHeader } from "@/shared/ui/panel";
import { Skeleton } from "@/shared/ui/skeleton";
import { Chip, StatusDot, type Tone } from "@/shared/ui/status-dot";

const STREAM_TONE: Record<string, Tone> = {
  open: "good",
  connecting: "warn",
  error: "bad",
  closed: "neutral",
  idle: "neutral",
};

export function SettingsPage() {
  const { project, select } = useActiveProject();
  const { data, isPending } = useProjects();
  const streamStatus = useUiStore((state) => state.streamStatus);

  return (
    <div className="space-y-4 pt-1">
      <Panel>
        <PanelHeader title="Connection" />
        <PanelBody>
          <dl className="divide-y divide-border/50">
            <Field label="API base">
              <span className="font-mono text-xs">{env.apiBase}</span>
            </Field>
            <Field label="Live stream">
              <span className="flex items-center gap-1.5">
                <StatusDot tone={STREAM_TONE[streamStatus] ?? "neutral"} />
                {streamStatus}
              </span>
            </Field>
          </dl>
          <Banner tone="info" className="mt-3">
            The API binds to localhost with no authentication. Do not expose the port.
          </Banner>
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader
          title="Projects"
          meta={data ? `${formatInteger(data.projects.length)} discovered` : undefined}
        />
        <PanelBody flush>
          {isPending ? (
            <Skeleton className="m-5 h-24" />
          ) : (
            <ul className="divide-y divide-border/50">
              {data?.projects.map((candidate) => (
                <li key={candidate.name} className="px-5 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => select(candidate.name)}
                      className="text-[13px] font-medium underline-offset-2 hover:underline"
                    >
                      {candidate.name}
                    </button>
                    {candidate.name === project ? <Chip tone="progress">selected</Chip> : null}
                    {candidate.is_active ? <Chip title="ORCH_PROJECT">default</Chip> : null}
                    {candidate.has_store ? <Chip tone="good">store</Chip> : <Chip>never run</Chip>}
                    {candidate.has_checkpoints ? <Chip>checkpoints</Chip> : null}
                  </div>

                  <dl className="mt-1.5 divide-y divide-border/40">
                    <Field label="Store">
                      <span className="truncate font-mono text-xs text-muted-foreground">
                        {candidate.store_path ?? "—"}
                      </span>
                    </Field>
                    <Field label="Checkout">
                      {candidate.repo_path ? (
                        <span className="flex flex-wrap items-baseline gap-2">
                          <span className="truncate font-mono text-xs">{candidate.repo_path}</span>
                          {candidate.repo_path_source !== "profile" ? (
                            <Chip tone="warn" title={candidate.runnable_detail ?? undefined}>
                              from {candidate.repo_path_source}
                            </Chip>
                          ) : null}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">none — runs cannot be started</span>
                      )}
                    </Field>
                  </dl>
                </li>
              ))}
            </ul>
          )}
        </PanelBody>
      </Panel>
    </div>
  );
}
