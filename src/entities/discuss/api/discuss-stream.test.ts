/**
 * The two places a session snapshot and the live stream can disagree.
 *
 * Both are races between one connection carrying a snapshot and another carrying
 * appends, and both fail silently — the transcript is simply missing a row, or
 * the composer is disabled with no question on screen and nothing on a timer to
 * come back and fix it.
 */

import { describe, expect, it } from "vitest";
import type { DiscussFrame, DiscussSession } from "../model";
import { applyFrame, mergeSession } from "./discuss-stream";

let seq = 0;
function frame(kind: string, data: Record<string, unknown> = {}): DiscussFrame {
  seq += 1;
  return { seq, ts: 1_785_000_000 + seq, kind, data };
}

function session(overrides: Partial<DiscussSession> = {}): DiscussSession {
  return {
    session_id: "s-1",
    project: "example",
    request: "add a project switcher",
    status: "running",
    expects: null,
    started_at: 1_785_000_000,
    last_activity_at: 1_785_000_000,
    error: null,
    applied: [],
    settings: {
      note: "",
      only_ids: null,
      effort: null,
      model: null,
      session_reuse: null,
      max_question_rounds: 0,
    },
    pins: [],
    frames: [],
    ...overrides,
  };
}

describe("applyFrame", () => {
  it("ignores a seq it already has", () => {
    // The replay window on reconnect overlaps by design.
    const repeated = frame("question", { q: "which store?" });
    const once = applyFrame(session(), repeated);
    expect(applyFrame(once, repeated)).toBe(once);
  });

  it("derives the status from the frame, as the server does", () => {
    const asking = applyFrame(session(), frame("awaiting", { expects: "answer" }));
    expect(asking).toMatchObject({ status: "awaiting", expects: "answer" });
    expect(applyFrame(asking, frame("thinking"))).toMatchObject({
      status: "running",
      expects: null,
    });
  });
});

describe("mergeSession", () => {
  it("keeps frames the response was serialized too early to contain", () => {
    // A mutation's response is a snapshot from when its handler ran. Anything the
    // planner pushed after that comes down the stream instead, and the stream's
    // cursor has already moved past — so a plain replace loses it for good.
    const asked = applyFrame(session(), frame("question", { q: "which store?" }));
    const cached = applyFrame(asked, frame("awaiting", { expects: "answer" }));
    const response = session({ frames: asked.frames, status: "running" });

    const merged = mergeSession(cached, response);

    expect(merged.frames.map((f) => f.kind)).toEqual(["question", "awaiting"]);
    // And the status is re-derived from the frame that survived, so a response
    // saying "running" cannot re-disable a composer the operator can now use.
    expect(merged).toMatchObject({ status: "awaiting", expects: "answer" });
  });

  it("takes the response wholesale when it is a different session", () => {
    const old = applyFrame(session({ session_id: "s-0" }), frame("question", { q: "?" }));
    const fresh = session({ session_id: "s-2" });
    expect(mergeSession(old, fresh)).toBe(fresh);
    expect(mergeSession(null, fresh)).toBe(fresh);
  });

  it("takes the response wholesale when the cache has nothing extra", () => {
    const response = applyFrame(session(), frame("thinking"));
    expect(mergeSession(session(), response)).toBe(response);
  });
});
