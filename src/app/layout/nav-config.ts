/**
 * The nav rail as a grouped outline (`DEVDOCS/DESIGN.md` §3.2), and the route
 * metadata the top bar reads.
 *
 * The children under Tasks are pre-filtered views, not a submenu: the four
 * statuses an operator actually chases get a permanent address instead of living
 * behind a dropdown you have to discover.
 */

import {
  BarChart3Icon,
  LayoutDashboardIcon,
  ListChecksIcon,
  MessagesSquareIcon,
  PlayCircleIcon,
  SettingsIcon,
} from "lucide-react";
import type { ComponentType } from "react";

export interface NavChild {
  to: string;
  label: string;
  /** Key into `Summary.queue_stats` for the trailing count. */
  statusKey: string;
}

export interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  children?: NavChild[];
}

export interface NavGroup {
  caption: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    caption: "Overview",
    items: [{ to: "/", label: "Dashboard", icon: LayoutDashboardIcon }],
  },
  {
    caption: "Pipeline",
    items: [
      {
        to: "/tasks",
        label: "Tasks",
        icon: ListChecksIcon,
        children: [
          { to: "/tasks?status=ready", label: "Ready", statusKey: "ready" },
          { to: "/tasks?status=running", label: "Running", statusKey: "running" },
          { to: "/tasks?status=needs_human", label: "Needs human", statusKey: "needs_human" },
          { to: "/tasks?status=failed", label: "Failed", statusKey: "failed" },
        ],
      },
      { to: "/runs", label: "Runs", icon: PlayCircleIcon },
      { to: "/planner", label: "Planner", icon: MessagesSquareIcon },
    ],
  },
  {
    caption: "Analysis",
    items: [{ to: "/stats", label: "Stats", icon: BarChart3Icon }],
  },
];

/** Rendered under a rule at the rail's foot, above the project switcher. */
export const PREFERENCES: NavItem[] = [{ to: "/settings", label: "Settings", icon: SettingsIcon }];

/**
 * Per-screen layout. `width: "reading"` centres the column for screens that are
 * read top-to-bottom; tables stay full-bleed (§3.1). `rail` is the *default*
 * state of the context rail — the operator's toggle wins once they touch it.
 */
export interface RouteMeta {
  section: string;
  width: "wide" | "reading";
  rail: boolean;
}

const ROUTE_META: Array<[RegExp, RouteMeta]> = [
  [/^\/$/, { section: "Dashboard", width: "wide", rail: true }],
  [/^\/tasks\/[^/]+$/, { section: "Tasks", width: "reading", rail: false }],
  [/^\/tasks$/, { section: "Tasks", width: "wide", rail: false }],
  [/^\/runs\/[^/]+$/, { section: "Runs", width: "wide", rail: true }],
  [/^\/runs$/, { section: "Runs", width: "wide", rail: false }],
  [/^\/planner$/, { section: "Planner", width: "reading", rail: false }],
  [/^\/stats$/, { section: "Stats", width: "wide", rail: false }],
  [/^\/settings$/, { section: "Settings", width: "reading", rail: false }],
];

export function routeMeta(pathname: string): RouteMeta {
  for (const [pattern, meta] of ROUTE_META) {
    if (pattern.test(pathname)) return meta;
  }
  return { section: "Not found", width: "reading", rail: false };
}
