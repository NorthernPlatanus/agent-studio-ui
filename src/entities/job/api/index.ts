/**
 * Query hooks for `job` — the supervised `run` / `plan` / `resume` /
 * `import-backlog` subprocesses. Shapes come from `src/shared/api/generated.ts`,
 * keys from `jobKeys` (project-first).
 */

export { jobLogQuery, jobQuery, jobsQuery, useJob, useJobs } from "./job-queries";
