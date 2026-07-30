import {
  BarChart3Icon,
  LayoutDashboardIcon,
  ListChecksIcon,
  MessagesSquareIcon,
  PlayCircleIcon,
  SettingsIcon,
} from "lucide-react";
import type { ComponentType } from "react";
import { NavLink, Outlet } from "react-router";
import { ThemeToggle } from "@/features/theme-toggle/theme-toggle";
import { cn } from "@/shared/lib/utils";

interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;
}

const NAV: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboardIcon },
  { to: "/tasks", label: "Tasks", icon: ListChecksIcon },
  { to: "/runs", label: "Runs", icon: PlayCircleIcon },
  { to: "/planner", label: "Planner", icon: MessagesSquareIcon },
  { to: "/stats", label: "Stats", icon: BarChart3Icon },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

export function AppLayout() {
  return (
    <div className="flex min-h-dvh bg-background text-foreground">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>

      <aside className="hidden w-56 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground sm:flex">
        <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
          <span className="text-sm font-semibold tracking-tight">agent-studio</span>
        </div>
        <nav aria-label="Main" className="flex-1 space-y-1 p-2">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                  "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-ring",
                  isActive
                    ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/75",
                )
              }
            >
              <Icon className="size-4" aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between gap-4 border-b border-border px-4">
          <nav aria-label="Main (compact)" className="flex gap-1 overflow-x-auto sm:hidden">
            {NAV.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                className={({ isActive }) =>
                  cn(
                    "whitespace-nowrap rounded-md px-2 py-1 text-xs",
                    isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground",
                  )
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
          </div>
        </header>

        <main id="main" className="min-w-0 flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
