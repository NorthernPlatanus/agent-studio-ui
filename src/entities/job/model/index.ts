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
