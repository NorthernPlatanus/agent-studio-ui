import type { components } from "@/shared/api/generated";
import type { Tone } from "@/shared/ui/status-dot";

export { jobKeys } from "./job-keys";

export type Job = components["schemas"]["Job"];
export type Jobs = components["schemas"]["Jobs"];
export type JobLog = components["schemas"]["JobLog"];

export const LIVE_JOB_STATUSES = new Set(["starting", "running"]);

export function isJobLive(job: Pick<Job, "status">): boolean {
  return LIVE_JOB_STATUSES.has(job.status);
}

const TONE: Readonly<Record<string, Tone>> = {
  starting: "progress",
  running: "progress",
  exited: "good",
  stopped: "warn",
  failed: "bad",
};

export function jobTone(status: string): Tone {
  return TONE[status] ?? "neutral";
}

/**
 * Turns a spawn failure into the sentence that tells the operator what to do.
 *
 * The server orders its preconditions so they can be told apart, and the whole
 * point of that ordering is lost if the UI renders one generic "request failed":
 *
 * | status | meaning | what the operator does |
 * |---|---|---|
 * | 422 | the body had no `confirm` | tick the confirmation |
 * | 409 | no `repo_path`, or a job already in flight | configure a checkout, or wait |
 * | 404 | unknown project, or nothing paused to resume | pick another project |
 *
 * 422 rather than 409 for a missing `confirm` is deliberate server-side: the
 * *body* is what is wrong, which keeps 409 meaning "the project's state says no".
 */
export function describeJobError(status: number, detail: unknown): string {
  const text = typeof detail === "string" ? detail : "";
  if (status === 422) {
    return "This request spends quota and was not confirmed. Tick the confirmation and try again.";
  }
  if (status === 409) {
    return text !== ""
      ? text
      : "Another job is already running for this project — only one runs at a time.";
  }
  if (status === 404) {
    return text !== "" ? text : "Nothing to act on.";
  }
  if (status === 0) return "Could not reach the API. Is `orchestrator serve` running?";
  return text !== "" ? text : `The job could not be started (HTTP ${status}).`;
}

/**
 * A finished job's exit code, in words.
 *
 * `exit_code: null` on a `failed` job is **expected, not a bug**: the API adopts
 * job sidecars after a restart, and a job whose pid is gone was never waited on,
 * so its code is unrecoverable (`DECISIONS.md` 2026-08-07). Saying "unknown" is
 * the honest rendering; showing 0 would report an interrupted run as a success.
 */
export function jobOutcome(job: Job): string {
  if (isJobLive(job)) return "in progress";
  if (job.exit_code === null || job.exit_code === undefined) return "exit code unknown";
  return job.exit_code === 0 ? "exit 0" : `exit ${job.exit_code}`;
}
