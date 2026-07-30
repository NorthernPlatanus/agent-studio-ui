import type { ReactNode } from "react";
import { Toaster } from "@/shared/ui/sonner";
import { QueryProvider } from "./query-provider";
import { ThemeProvider } from "./theme-provider";

/** Everything global, in one place: theme, server-state cache, toasts. */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <QueryProvider>
        {children}
        <Toaster position="bottom-right" richColors />
      </QueryProvider>
    </ThemeProvider>
  );
}

export { createQueryClient, QueryProvider } from "./query-provider";
export { ThemeProvider } from "./theme-provider";
