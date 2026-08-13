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

/** FastAPI's 422 shape: `detail` is a list, not a string (CONTRACT §2). */
interface ValidationIssue {
  msg?: unknown;
  loc?: unknown;
}

/**
 * The messages out of a 422's `detail` array, deduplicated and tidied.
 *
 * Pydantic prefixes its own text with `Value error, `, which is noise to an
 * operator, and repeats the same message once per offending field.
 */
function validationMessages(detail: unknown): string[] {
  if (!Array.isArray(detail)) return [];
  const seen = new Set<string>();
  for (const issue of detail as ValidationIssue[]) {
    const raw = typeof issue?.msg === "string" ? issue.msg : "";
    const message = raw.replace(/^Value error,\s*/, "").trim();
    if (message !== "") seen.add(message);
  }
  return [...seen];
}

/**
 * Turns a spawn failure into the sentence that tells the operator what to do.
 *
 * The server orders its preconditions so they can be told apart, and the whole
 * point of that ordering is lost if the UI renders one generic "request failed":
 *
 * | status | meaning | what the operator does |
 * |---|---|---|
 * | 422 | the body failed validation | fix whatever `detail` names |
 * | 409 | no `repo_path`, or a job already in flight | configure a checkout, or wait |
 * | 404 | unknown project, or nothing paused to resume | pick another project |
 *
 * 422 rather than 409 for a missing `confirm` is deliberate server-side: the
 * *body* is what is wrong, which keeps 409 meaning "the project's state says no".
 *
 * A missing `confirm` is only ONE of the things that 422s, though — `n` is
 * bounded `1..64`, a plan note may not start with `-`, and any future validator
 * lands here too. Hard-coding the confirm sentence told an operator whose `n`
 * was out of range to re-tick a box that was already ticked, and never showed
 * them the range. So the server's own messages are rendered, and the confirm
 * copy is reserved for a 422 that really is about confirmation.
 */
export function describeJobError(status: number, detail: unknown): string {
  const text = typeof detail === "string" ? detail : "";
  if (status === 422) {
    const issues = validationMessages(detail);
    const aboutConfirm = issues.some((message) => /confirm/i.test(message));
    if (issues.length === 0 || aboutConfirm) {
      return "This request spends quota and was not confirmed. Tick the confirmation and try again.";
    }
    return issues.join(" ");
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
