import { describe, expect, it } from "vitest";
import type { Job } from "./index";
import { describeJobError, isJobLive, jobOutcome, jobTone } from "./index";

function job(overrides: Partial<Job> = {}): Job {
  return {
    job_id: "j1",
    project: "example",
    command: "run",
    status: "exited",
    argv: ["python", "-m", "orchestrator", "run"],
    started_at: 0,
    ...overrides,
  };
}

describe("job outcome", () => {
  it("reports an unknown exit code rather than inventing a success", () => {
    // A `failed` job with `exit_code: null` is expected, not a bug: the API
    // adopts sidecars after a restart and never waited on that process.
    expect(jobOutcome(job({ status: "failed", exit_code: null }))).toBe("exit code unknown");
    expect(jobOutcome(job({ status: "exited", exit_code: 0 }))).toBe("exit 0");
    expect(jobOutcome(job({ status: "failed", exit_code: 2 }))).toBe("exit 2");
  });

  it("does not report an outcome for a job that is still going", () => {
    expect(jobOutcome(job({ status: "running" }))).toBe("in progress");
    expect(isJobLive(job({ status: "starting" }))).toBe(true);
    expect(isJobLive(job({ status: "stopped" }))).toBe(false);
  });

  it("tones a stopped job as a warning, not a failure", () => {
    expect(jobTone("stopped")).toBe("warn");
    expect(jobTone("failed")).toBe("bad");
    expect(jobTone("running")).toBe("progress");
  });
});

describe("describeJobError", () => {
  // The server orders its preconditions so they can be told apart; collapsing
  // them into one message throws that away.
  it("tells a missing confirmation apart from a busy project", () => {
    expect(describeJobError(422, null)).toMatch(/not confirmed/i);
    expect(describeJobError(409, "a run job is already in flight")).toBe(
      "a run job is already in flight",
    );
  });

  it("falls back to a usable sentence when the server sends no detail", () => {
    expect(describeJobError(409, null)).toMatch(/only one runs at a time/i);
    expect(describeJobError(0, null)).toMatch(/orchestrator serve/);
  });
});
