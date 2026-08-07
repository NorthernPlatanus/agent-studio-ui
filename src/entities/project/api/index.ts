/**
 * Query hooks for `project` — the discovery endpoint plus the project-scoped
 * aggregates that belong to no single row (`…/summary`, `…/metrics`, `…/waves`).
 * Shapes come from `src/shared/api/generated.ts`; requests go through
 * `shared/api/client`.
 */

export {
  metricsQuery,
  projectsQuery,
  summaryQuery,
  useMetrics,
  useProjects,
  useSummary,
  useWaves,
  wavesQuery,
} from "./project-queries";
