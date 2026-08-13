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

import { useEffect, useRef } from "react";
import { Outlet, useLocation, useParams } from "react-router";
import { LiveStreamProvider } from "@/app/providers/live-stream-provider";
import { useTask } from "@/entities/task/api";
import { useActiveProject } from "@/features/project-switch";
import { useScrollProgress } from "@/shared/hooks";
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
  const mainRef = useRef<HTMLElement>(null);
  const scrolled = useScrollProgress(mainRef);

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

  // The scroll container outlives the route, so without this a drill-down from
  // halfway down the task table opens the detail screen already scrolled.
  // biome-ignore lint/correctness/useExhaustiveDependencies: pathname is the trigger, not an input — the effect reads nothing and fires on navigation.
  useEffect(() => {
    // `scrollTop = 0`, not `scrollTo()`: the latter is not implemented on
    // elements in jsdom, so it throws in every test that mounts the shell.
    const element = mainRef.current;
    if (element) element.scrollTop = 0;
  }, [pathname]);

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

        {/* `relative` because the top bar is absolutely positioned over this
            column: the work area scrolls *under* the chrome, which is what lets
            the chrome be invisible at rest and blur what passes beneath it. */}
        <div className="relative flex min-w-0 flex-1 flex-col">
          <TopBar
            project={project}
            subject={subject}
            onToggleNav={toggleSidebar}
            onToggleRail={() => setRailOpen(!railOpen, { user: true })}
            railOpen={railOpen}
            scrolled={scrolled}
          />

          <div className="flex min-h-0 flex-1 gap-3">
            <main
              id="main"
              ref={mainRef}
              className={cn(
                "min-w-0 flex-1 px-4 pt-14",
                // A `fill` screen is a frame, not a document: it must not scroll,
                // or the region inside it that does would be the second scrollbar.
                meta.height === "fill" ? "overflow-hidden pb-4" : "overflow-y-auto pb-8",
              )}
            >
              {/* The scroll container stays full-bleed so the blur spans the
                  column; the *content* is what gets capped. `wide` still has a
                  cap — a table stretched across 2560px is unreadable. */}
              {/*
                `@container` is load-bearing, not decoration. The work column's
                width is the viewport minus a collapsible nav rail minus a
                collapsible activity rail, so a viewport breakpoint says almost
                nothing about how much room a grid actually has: at 1440px this
                column is 1150px with both rails shut and 600px with both open.
                Screens therefore respond to *this* element (`@3xl:` etc.), which
                is the width they are really laid out in.
              */}
              <div
                className={cn(
                  "@container mx-auto w-full",
                  meta.width === "reading" ? "max-w-4xl" : "max-w-[100rem]",
                  meta.height === "fill" && "h-full min-h-0",
                )}
              >
                <Outlet />
              </div>
            </main>
            {railOpen ? <ContextRail project={project} /> : null}
          </div>
        </div>
      </div>
    </LiveStreamProvider>
  );
}
