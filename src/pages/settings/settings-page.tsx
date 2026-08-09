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
import { useActiveProject } from "@/features/project-switch";
import { ApiError } from "@/shared/api/client";
import { env } from "@/shared/config/env";
import { formatInteger } from "@/shared/lib/format";
import { describeStream } from "@/shared/lib/stream-status";
import { useUiStore } from "@/shared/store/ui-store";
import { Banner } from "@/shared/ui/banner";
import { Field } from "@/shared/ui/metric";
import { Panel, PanelBody, PanelHeader } from "@/shared/ui/panel";
import { Screen } from "@/shared/ui/screen";
import { Skeleton } from "@/shared/ui/skeleton";
import { Chip, StatusDot } from "@/shared/ui/status-dot";

export function SettingsPage() {
  const { project, select } = useActiveProject();
  const { data, isPending, error } = useProjects();
  const streamStatus = useUiStore((state) => state.streamStatus);
  const stream = describeStream(streamStatus);

  return (
    <Screen>
      <Panel>
        <PanelHeader title="Connection" />
        <PanelBody>
          <dl className="divide-y divide-border/50">
            <Field label="API base">
              <span className="font-mono text-xs">{env.apiBase}</span>
            </Field>
            <Field label="Live stream">
              <span className="flex items-center gap-1.5">
                <StatusDot tone={stream.tone} pulse={streamStatus === "connecting"} />
                {stream.label}
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
          {/* An unreachable API is the likeliest failure on this screen — it is the
              one place that says where the API *is* — so it must say so rather
              than spinning a skeleton forever. */}
          {error ? (
            <div className="p-5">
              <Banner tone="bad">
                Could not reach the API at <span className="font-mono text-xs">{env.apiBase}</span>.
                {error instanceof ApiError && error.status === 0
                  ? " Is `orchestrator serve` running?"
                  : null}
              </Banner>
            </div>
          ) : isPending ? (
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
    </Screen>
  );
}
