/**
 * Runtime configuration, read once from Vite's env.
 *
 * `VITE_API_BASE` points at the orchestrator FastAPI dev server. See `.env.example`.
 */

const DEFAULT_API_BASE = "http://127.0.0.1:8787";

function readApiBase(): string {
  const raw = import.meta.env.VITE_API_BASE;
  const value = typeof raw === "string" && raw.trim() !== "" ? raw.trim() : DEFAULT_API_BASE;
  // Normalize away a trailing slash so path joining is unambiguous.
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

export const env = {
  apiBase: readApiBase(),
  isDev: import.meta.env.DEV,
} as const;

export { DEFAULT_API_BASE };
