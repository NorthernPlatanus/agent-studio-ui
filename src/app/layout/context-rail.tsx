/**
 * The context rail — the reference's "Use cases" column, repurposed to the only
 * thing that is genuinely ambient in an orchestrator console: **live activity**
 * (`DEVDOCS/DESIGN.md` §3.1).
 *
 * It is a floating panel, not a bordered third column: no full-height divider,
 * same background as the page, its own rounded surface. It never drives the
 * task, so it collapses, and its default per screen comes from `routeMeta`.
 */

import { Panel, PanelHeader } from "@/shared/ui/panel";
import { EventLog } from "@/widgets/event-log";
import { JobConsole } from "@/widgets/job-console";

export function ContextRail({ project }: { project: string | null }) {
  return (
    <aside
      aria-label="Activity"
      className="hidden w-80 shrink-0 flex-col gap-3 overflow-y-auto pb-4 pr-4 lg:flex"
    >
      <Panel>
        <PanelHeader title="Jobs" />
        <JobConsole project={project} limit={4} />
      </Panel>

      <Panel className="flex min-h-0 flex-1 flex-col">
        <PanelHeader title="Activity" />
        <div className="min-h-0 flex-1 overflow-y-auto">
          <EventLog project={project} count={40} compact />
        </div>
      </Panel>
    </aside>
  );
}
