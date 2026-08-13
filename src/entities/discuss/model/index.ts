/**
 * The planner chat's own vocabulary.
 *
 * A session is a **state machine**, not a message list, and the UI has to render
 * the state as much as the text: whether the loop is thinking, waiting on an
 * answer, waiting on a decision about a spec preview, or finished. The server
 * emits that as frames; these selectors read it back out.
 */

import type { components } from "@/shared/api/generated";
import type { Tone } from "@/shared/ui/status-dot";

export { discussKeys } from "./discuss-keys";
export {
  MAX_PINS,
  readUpload,
  type UploadedPin,
  UploadRejected,
  uploadDisplayPath,
} from "./uploads";

export type DiscussState = components["schemas"]["DiscussState"];
export type DiscussSession = components["schemas"]["DiscussSessionModel"];
export type DiscussFrame = components["schemas"]["DiscussFrame"];
export type DiscussSettings = components["schemas"]["DiscussSettingsModel"];
export type DiscussOptions = components["schemas"]["DiscussOptions"];
export type PinnedFileInfo = components["schemas"]["PinnedFileInfo"];
export type StartDiscussRequest = components["schemas"]["StartDiscussRequest"];

/** A planner spec, as proposed — the same open blob `TaskDetail.spec` carries. */
export type ProposedSpec = Record<string, unknown>;

const TONE: Readonly<Record<string, Tone>> = {
  running: "progress",
  awaiting: "warn",
  done: "good",
  aborted: "neutral",
  failed: "bad",
};

export function sessionTone(status: string): Tone {
  return TONE[status] ?? "neutral";
}

export function isSessionLive(session: DiscussSession | null | undefined): boolean {
  return session?.status === "running" || session?.status === "awaiting";
}

/** True while the planner is mid-call and the composer must stay disabled. */
export function isThinking(session: DiscussSession | null | undefined): boolean {
  return session?.status === "running";
}

/**
 * The specs currently on the table, from the newest `specs_preview` frame.
 *
 * Newest wins rather than accumulating: an `edit` round replaces the proposal
 * wholesale, and showing both would offer an approve button for a plan the
 * planner has already withdrawn.
 */
export function proposedSpecs(session: DiscussSession | null | undefined): ProposedSpec[] {
  if (!session) return [];
  for (let index = session.frames.length - 1; index >= 0; index -= 1) {
    const frame = session.frames[index];
    if (frame?.kind === "specs_preview") {
      const specs = frame.data.specs;
      return Array.isArray(specs) ? (specs as ProposedSpec[]) : [];
    }
  }
  return [];
}

/** Assumptions the planner has stated, in order, deduplicated. */
export function assumptions(session: DiscussSession | null | undefined): string[] {
  const seen = new Set<string>();
  for (const frame of session?.frames ?? []) {
    if (frame.kind === "assumption" && typeof frame.data.text === "string") {
      seen.add(frame.data.text);
    }
  }
  return [...seen];
}

/**
 * What the composer should do with the next thing the operator types.
 *
 * `decision` is not free text — the loop reads `y` / `edit` / `abort` — so the
 * composer swaps itself for buttons rather than letting someone type "sure" and
 * have it silently taken as the edit note. `retry` is the same shape for the
 * same reason: the loop treats an empty reply as "just try again", which a text
 * box cannot send.
 *
 * Derived from the generated schema rather than restated. Hand-writing this list
 * is how the UI silently ignored a state the server had already started sending.
 */
export type Expects = NonNullable<DiscussSession["expects"]> | null;

export function expects(session: DiscussSession | null | undefined): Expects {
  return session?.status === "awaiting" ? (session.expects ?? null) : null;
}

/** Human wording for what a session is doing, for the status chip. */
export function describeSession(session: DiscussSession): string {
  switch (session.status) {
    case "running":
      return "Planner is working";
    case "awaiting":
      // `awaiting` is not always a question. Two of its states are the loop
      // waiting on something of its own, and calling either "waiting on your
      // answer" tells the operator to do something there is nothing to do about.
      switch (session.expects) {
        case "decision":
          return "Waiting on your decision";
        case "retry":
          return "That turn failed — retry?";
        case "frozen":
          return "Paused — subscription limit";
        default:
          return "Waiting on your answer";
      }
    case "done":
      return `Applied ${session.applied.length} spec${session.applied.length === 1 ? "" : "s"}`;
    case "aborted":
      return "Closed — nothing applied";
    case "failed":
      return "Failed";
    default:
      return session.status;
  }
}
