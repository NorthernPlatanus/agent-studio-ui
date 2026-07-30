import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

/**
 * Light + dark from day one: `prefers-color-scheme` by default (`defaultTheme:
 * "system"`), overridable by the explicit toggle in `features/theme-toggle`.
 * The class strategy matches the `@custom-variant dark` in `app/styles/globals.css`.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
