import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/shared/ui/button";

const ORDER = ["system", "light", "dark"] as const;
type ThemeName = (typeof ORDER)[number];

const LABEL: Record<ThemeName, string> = {
  system: "Theme: follow system",
  light: "Theme: light",
  dark: "Theme: dark",
};

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const current: ThemeName = ORDER.includes(theme as ThemeName) ? (theme as ThemeName) : "system";
  const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length] ?? "system";

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={LABEL[current]}
      title={LABEL[current]}
      onClick={() => setTheme(next)}
    >
      {current === "light" ? (
        <SunIcon aria-hidden="true" />
      ) : current === "dark" ? (
        <MoonIcon aria-hidden="true" />
      ) : (
        <MonitorIcon aria-hidden="true" />
      )}
    </Button>
  );
}
