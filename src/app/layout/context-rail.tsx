/**
 * The context rail — the reference's "Use cases" column, repurposed to the only
 * thing that is genuinely ambient in an orchestrator console: **live activity**
 * (`devdocs/DESIGN.md` §3.1).
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
    // Appears at `xl`, not `lg`: at 1024px the nav rail and a 320px activity
    // column leave the work area around 440px, which is narrower than the
    // narrowest table in the app. Better to keep the rail shut until there is
    // room for both than to ship a squeezed default.
    <aside
      aria-label="Activity"
      className="hidden w-72 shrink-0 flex-col gap-3 overflow-y-auto pb-6 pr-4 pt-14 xl:flex 2xl:w-80"
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
