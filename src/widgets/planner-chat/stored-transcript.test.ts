/**
 * The `ROLE: text` blob, back into turns.
 *
 * The shapes asserted here are the ones `nodes/discuss._format` actually writes,
 * including the two that made the old `<pre>` unreadable: a run of
 * `(resumed session)` markers at the head of a resumed conversation, and a
 * `PLANNER:` turn that is `json.dumps(env)` rather than anything a person wrote.
 */

import { describe, expect, it } from "vitest";
import { parseStoredTranscript, plannerEnvelope } from "./stored-transcript";

describe("parseStoredTranscript", () => {
  it("collapses a run of resume markers into one row", () => {
    // The real store this was written against opens with four of them: each
    // resume nests the prior transcript, which itself opens with a marker.
    const turns = parseStoredTranscript(
      "SYSTEM: (resumed session)\nSYSTEM: (resumed session)\nSYSTEM: (resumed session)\nUSER: go",
    );
    expect(turns).toEqual([
      { key: 0, role: "resumed", text: "", count: 3 },
      { key: 1, role: "you", text: "go" },
    ]);
  });

  it("keeps a multi-line operator turn whole", () => {
    // The continuation lines carry no prefix, so a naive line-per-turn split
    // would drop everything past the first line of a long brief — which is
    // most of what is in a real planner blob.
    const turns = parseStoredTranscript("USER: first line\nsecond line\n\nfourth\nUSER: next");
    expect(turns).toEqual([
      { key: 0, role: "you", text: "first line\nsecond line\n\nfourth" },
      { key: 1, role: "you", text: "next" },
    ]);
  });

  it("does not split an operator's message on a line that looks like a prefix", () => {
    // `NOTE:` is not a role the loop writes, and an operator's brief is full of
    // lines like it. Splitting there would attribute half their message to
    // someone who was never in the conversation.
    const turns = parseStoredTranscript("USER: do the thing\nNOTE: careful\nTODO: later");
    expect(turns).toHaveLength(1);
    expect(turns[0]?.text).toBe("do the thing\nNOTE: careful\nTODO: later");
  });

  it("reads the trailing APPLIED marker as its own terminal row", () => {
    const turns = parseStoredTranscript("USER: ship it\nAPPLIED");
    expect(turns.map((t) => t.role)).toEqual(["you", "applied"]);
    // And it is not left glued to the end of the operator's sentence.
    expect(turns[0]?.text).toBe("ship it");
  });

  it("keeps a planner turn as a planner turn", () => {
    const turns = parseStoredTranscript('PLANNER: {"questions":[]}\nUSER: ok');
    expect(turns.map((t) => t.role)).toEqual(["planner", "you"]);
  });

  it("keeps text that has no prefix at all", () => {
    // A store shape this parser does not know. Losing it silently would be
    // worse than the `<pre>` this replaced.
    expect(parseStoredTranscript("just some text")).toEqual([
      { key: 0, role: "planner", text: "just some text" },
    ]);
  });

  it("finds nothing in an empty blob", () => {
    expect(parseStoredTranscript("")).toEqual([]);
    expect(parseStoredTranscript("   \n\n ")).toEqual([]);
  });
});

describe("plannerEnvelope", () => {
  it("reads the questions and assumptions out of the stored envelope", () => {
    expect(
      plannerEnvelope(
        JSON.stringify({
          assumptions: ["the store is sqlite", "  "],
          questions: [{ id: "q1", q: "Which store?", why: "changes files" }, { q: "" }],
          specs: [{ id: "T-1" }, { id: "T-2" }],
        }),
      ),
    ).toEqual({
      assumptions: ["the store is sqlite"],
      questions: [{ id: "q1", q: "Which store?", why: "changes files" }],
      specs: [{ id: "T-1" }, { id: "T-2" }],
    });
  });

  it("keeps the stored specs whole rather than counting them", () => {
    // The regression this replaces: the specs were reduced to a number and the
    // row said "the plan itself was not kept in this format" on top of four
    // complete ones. Every field the spec card reads has to survive.
    const env = plannerEnvelope(
      JSON.stringify({
        specs: [
          {
            id: "T-9",
            title: "Wire the overlay",
            files_write: ["src/a.ts"],
            risk: "medium",
            agent_able: false,
          },
        ],
      }),
    );
    expect(env?.specs).toEqual([
      {
        id: "T-9",
        title: "Wire the overlay",
        files_write: ["src/a.ts"],
        risk: "medium",
        agent_able: false,
      },
    ]);
  });

  it("drops spec entries that are not objects", () => {
    // The blob is whatever an older planner serialised. A string in `specs`
    // would reach `SpecCard` and read every field off it as undefined.
    expect(
      plannerEnvelope(JSON.stringify({ specs: ["T-1", null, 3, { id: "T-2" }] }))?.specs,
    ).toEqual([{ id: "T-2" }]);
  });

  it("declines anything that is not a populated envelope", () => {
    // Falling back to the raw blob is right here: an empty row under a
    // "Planner" gutter would say the planner spoke and said nothing.
    expect(plannerEnvelope("not json")).toBeNull();
    expect(plannerEnvelope("[1,2]")).toBeNull();
    expect(plannerEnvelope('{"questions":[],"specs":[]}')).toBeNull();
  });
});
