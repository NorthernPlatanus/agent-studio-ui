/**
 * Query hooks and spawners for `job` — the supervised `run` / `plan` / `resume` /
 * `import-backlog` subprocesses. Shapes come from `src/shared/api/generated.ts`,
 * keys from `jobKeys` (project-first).
 */

export {
  type JobAccepted,
  type PlanRequest,
  type ResumeRequest,
  type RunRequest,
  useImportBacklog,
  useResumeRun,
  useStartPlan,
  useStartRun,
  useStopJob,
} from "./job-mutations";
export { jobLogQuery, jobQuery, jobsQuery, useJob, useJobs } from "./job-queries";
