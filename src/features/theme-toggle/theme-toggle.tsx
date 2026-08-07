/**
 * Theme, as a **nav-rail row** rather than a header icon button
 * (`DEVDOCS/DESIGN.md` §3.2, from the reference's `Theme  System ⌄` row).
 *
 * A global preference is navigation, not a tool: putting it in the top bar spends
 * the most valuable strip of chrome in the app on something touched twice a year.
 */

import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/shared/lib/utils";

const ORDER = ["system", "light", "dark"] as const;
type ThemeName = (typeof ORDER)[number];

const LABEL: Record<ThemeName, string> = { system: "System", light: "Light", dark: "Dark" };
const ICON = { system: MonitorIcon, light: SunIcon, dark: MoonIcon };

function currentTheme(theme: string | undefined): ThemeName {
  return ORDER.includes(theme as ThemeName) ? (theme as ThemeName) : "system";
}

export function ThemeToggle({ collapsed = false }: { collapsed?: boolean }) {
  const { theme, setTheme } = useTheme();
  const active = currentTheme(theme);
  const Icon = ICON[active];
  const next = ORDER[(ORDER.indexOf(active) + 1) % ORDER.length] ?? "system";

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={`Theme: ${LABEL[active]}. Switch to ${LABEL[next]}`}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] transition-colors",
        "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-ring",
        collapsed && "justify-center px-0",
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      {collapsed ? null : (
        <>
          <span className="flex-1 text-left">Theme</span>
          <span className="text-[11px] text-muted-foreground">{LABEL[active]}</span>
        </>
      )}
    </button>
  );
}
