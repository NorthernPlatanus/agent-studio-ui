/**
 * The grouped nav outline (`devdocs/DESIGN.md` §3.2), floating on the page
 * background (§3.3).
 *
 * No fill and no right border: the rail is not a slab, it is a column of
 * controls. The active row is a **raised chip** — the reference's selected
 * `Datacenter Proxy` — which is what makes selection read as elevation rather
 * than as a highlighted table row.
 *
 * Counts come off the dashboard's own `…/summary` query, so the rail costs no
 * extra request and can tell you `Failed 1` before you think to ask.
 */

import type { ReactNode } from "react";
import { NavLink, useLocation } from "react-router";
import { useSummary } from "@/entities/project/api";
import { ProjectSwitcher } from "@/features/project-switch";
import { ThemeToggle } from "@/features/theme-toggle";
import { formatInteger } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";
import { FOCUS_RING } from "@/shared/ui/focus";
import { StatusDot } from "@/shared/ui/status-dot";
import { NAV_GROUPS, type NavChild, type NavItem, PREFERENCES } from "./nav-config";

const ROW = cn(
  "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] transition-[color,box-shadow]",
  FOCUS_RING,
);
const IDLE =
  "border border-transparent text-foreground/70 hover:bg-foreground/5 hover:text-foreground";
const ACTIVE = "border border-border bg-card font-medium text-foreground shadow-xs";

function Count({ value }: { value: number | undefined }) {
  if (value === undefined || value === 0) return null;
  return (
    <span className="ml-auto shrink-0 text-[11px] tabular-nums text-muted-foreground">
      {formatInteger(value)}
    </span>
  );
}

function ChildRow({ child, count }: { child: NavChild; count: number | undefined }) {
  const location = useLocation();
  const [path, query = ""] = child.to.split("?");
  const isActive = location.pathname === path && location.search.replace(/^\?/, "") === query;
  return (
    <NavLink to={child.to} className={cn(ROW, "py-1 pl-9 text-[12.5px]", isActive ? ACTIVE : IDLE)}>
      <span className="truncate">{child.label}</span>
      <Count value={count} />
    </NavLink>
  );
}

function ItemRow({
  item,
  collapsed,
  counts,
  trailing,
}: {
  item: NavItem;
  collapsed: boolean;
  counts: Readonly<Record<string, number>> | undefined;
  trailing?: ReactNode;
}) {
  const total = item.children
    ? Object.values(counts ?? {}).reduce((sum, value) => sum + value, 0)
    : undefined;

  return (
    <li>
      <NavLink
        to={item.to}
        end={item.to === "/"}
        title={collapsed ? item.label : undefined}
        className={({ isActive }) =>
          cn(ROW, collapsed && "justify-center px-0", isActive ? ACTIVE : IDLE)
        }
      >
        <item.icon className="size-4 shrink-0" aria-hidden="true" />
        {collapsed ? null : (
          <>
            <span className="truncate">{item.label}</span>
            {trailing ?? <Count value={total} />}
          </>
        )}
      </NavLink>
      {!collapsed && item.children ? (
        <div className="mt-0.5 space-y-px">
          {item.children.map((child) => (
            <ChildRow key={child.to} child={child} count={counts?.[child.statusKey]} />
          ))}
        </div>
      ) : null}
    </li>
  );
}

/** Inset, not full-bleed: a hairline that reaches both edges is the BIOS look. */
function Rule() {
  return <div className="mx-2.5 my-2 h-px bg-border/70" aria-hidden="true" />;
}

export function NavRail({ collapsed, project }: { collapsed: boolean; project: string | null }) {
  const summary = useSummary(project);
  const counts = summary.data?.queue_stats;
  const runStatus = summary.data?.active_run?.status;

  const runDot =
    runStatus === "running" ? (
      <StatusDot tone="progress" className="ml-auto" />
    ) : runStatus === "paused" ? (
      <StatusDot tone="warn" className="ml-auto" />
    ) : undefined;

  return (
    <aside
      className={cn("hidden shrink-0 flex-col gap-1 p-2 sm:flex", collapsed ? "w-14" : "w-58")}
    >
      <div
        className={cn(
          "flex h-10 shrink-0 items-center",
          collapsed ? "justify-center px-0" : "px-2.5",
        )}
      >
        <span className="flex size-5 items-center justify-center rounded bg-foreground text-[10px] font-bold text-background">
          A
        </span>
        {collapsed ? null : (
          <span className="ml-2.5 truncate text-[13px] font-semibold tracking-tight">
            agent-studio
          </span>
        )}
      </div>

      <nav aria-label="Main" className="min-h-0 flex-1 space-y-4 overflow-y-auto">
        {NAV_GROUPS.map((group) => (
          <div key={group.caption}>
            {collapsed ? null : (
              <h2 className="px-2.5 pb-1.5 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                {group.caption}
              </h2>
            )}
            <ul className="space-y-px">
              {group.items.map((item) => (
                <ItemRow
                  key={item.to}
                  item={item}
                  collapsed={collapsed}
                  counts={counts}
                  {...(item.to === "/runs" && runDot ? { trailing: runDot } : {})}
                />
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="shrink-0">
        <Rule />
        {collapsed ? null : (
          <h2 className="px-2.5 pb-1.5 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
            Preferences
          </h2>
        )}
        <ul className="space-y-px">
          {PREFERENCES.map((item) => (
            <ItemRow key={item.to} item={item} collapsed={collapsed} counts={undefined} />
          ))}
          <li>
            <ThemeToggle collapsed={collapsed} />
          </li>
        </ul>
        <Rule />
        <ProjectSwitcher collapsed={collapsed} />
      </div>
    </aside>
  );
}
