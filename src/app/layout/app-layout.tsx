/**
 * The three-zone shell: navigate · work · context (`DEVDOCS/DESIGN.md` §3.1).
 *
 * All three zones sit on the same page background with no dividing hairlines —
 * what separates them is space and the raised surfaces inside them (§3.3).
 *
 * The layout, not the page, resolves the location chip's subject: a detail route
 * knows its object from the URL, and making every screen push a title into the
 * chrome would put chrome concerns in seven page components.
 */

import { useEffect } from "react";
import { Outlet, useLocation, useParams } from "react-router";
import { LiveStreamProvider } from "@/app/providers/live-stream-provider";
import { useTask } from "@/entities/task/api";
import { useActiveProject } from "@/features/project-switch/use-active-project";
import { cn } from "@/shared/lib/utils";
import { useUiStore } from "@/shared/store/ui-store";
import { ContextRail } from "./context-rail";
import { routeMeta } from "./nav-config";
import { NavRail } from "./nav-rail";
import { TopBar } from "./top-bar";

/** The trailing half of the location chip, resolved from the route. */
function useSubject(project: string | null): string | null {
  const { taskId, runId } = useParams();
  const task = useTask(project, taskId);

  if (taskId !== undefined) {
    const title = task.data?.title;
    return title === undefined ? taskId : `${taskId} · ${title}`;
  }
  if (runId !== undefined) return runId;
  return null;
}

export function AppLayout() {
  const { pathname } = useLocation();
  const meta = routeMeta(pathname);
  const { project } = useActiveProject();
  const subject = useSubject(project);

  const collapsed = useUiStore((state) => state.layout.sidebarCollapsed);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);
  const railOpen = useUiStore((state) => state.layout.contextRailOpen);
  const setRailOpen = useUiStore((state) => state.setContextRail);
  const railTouched = useUiStore((state) => state.layout.contextRailTouched);

  // The route's `rail` is a default, not a rule: once the operator has used the
  // toggle, their choice follows them across screens.
  useEffect(() => {
    if (!railTouched) setRailOpen(meta.rail, { user: false });
  }, [meta.rail, railTouched, setRailOpen]);

  return (
    <LiveStreamProvider project={project}>
      <div className="flex h-dvh overflow-hidden bg-background text-foreground">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
        >
          Skip to content
        </a>

        <NavRail collapsed={collapsed} project={project} />

        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar
            project={project}
            subject={subject}
            onToggleNav={toggleSidebar}
            onToggleRail={() => setRailOpen(!railOpen, { user: true })}
            railOpen={railOpen}
          />

          <div className="flex min-h-0 flex-1 gap-3">
            <main
              id="main"
              className={cn(
                "min-w-0 flex-1 overflow-y-auto px-4 pb-6",
                meta.width === "reading" && "mx-auto w-full max-w-4xl",
              )}
            >
              <Outlet />
            </main>
            {railOpen ? <ContextRail project={project} /> : null}
          </div>
        </div>
      </div>
    </LiveStreamProvider>
  );
}
