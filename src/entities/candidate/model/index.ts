import type { components } from "@/shared/api/generated";

export { candidateKeys } from "./candidate-keys";

export type Candidate = components["schemas"]["Candidate"];
export type Candidates = components["schemas"]["Candidates"];
export type CandidateSource = Candidates["source"];

/**
 * What the board may claim, per source (CONTRACT §4). Only a checkpoint read can
 * describe an in-flight attempt; the events fallback is history, and its `null`
 * branch/worktree/notes mean "not retained", not "failed".
 */
export const SOURCE_LABEL: Readonly<Record<CandidateSource, string>> = {
  checkpoint: "Live (checkpoint)",
  events: "History (event log)",
  none: "Nothing recorded",
};

export const SOURCE_EXPLANATION: Readonly<Record<CandidateSource, string>> = {
  checkpoint:
    "Read from the run's LangGraph checkpoint — attempt, status, branch, worktree and notes are current.",
  events:
    "Reconstructed from gate / candidate_failed / no_patch events. Branch, worktree and notes were not retained, and no diff is available.",
  none: "No checkpoint and no matching events for this task — nothing ran, or the checkpoint was pruned.",
};

/** Only a checkpoint read can show an attempt that is still in flight. */
export function canShowInFlight(source: CandidateSource): boolean {
  return source === "checkpoint";
}

export type CandidateTone = "neutral" | "progress" | "good" | "bad";

const TONES: Readonly<Record<string, CandidateTone>> = {
  gate_passed: "good",
  gate_failed: "bad",
  patch_failed: "bad",
  llm_failed: "bad",
  visual_failed: "bad",
  visual_unverifiable: "neutral",
  skipped: "neutral",
};

/** A `null` status on a checkpoint read is an attempt still running. */
export function candidateTone(candidate: Pick<Candidate, "status">): CandidateTone {
  if (candidate.status === null || candidate.status === undefined) return "progress";
  return TONES[candidate.status] ?? "neutral";
}

export function isInFlight(candidate: Pick<Candidate, "status">): boolean {
  return candidate.status === null || candidate.status === undefined;
}

/** The winner, if the gate picked one. */
export function passedCandidates(candidates: readonly Candidate[]): Candidate[] {
  return candidates.filter((candidate) => candidate.status === "gate_passed");
}
