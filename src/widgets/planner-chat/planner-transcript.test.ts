/**
 * When the transcript is allowed to jump to the bottom.
 *
 * A pure predicate rather than a rendered assertion, because jsdom reports zero
 * for `scrollHeight`, `scrollTop` and `clientHeight` alike — every element looks
 * pinned to its own tail there, so the one behaviour worth pinning cannot be
 * observed through the DOM.
 *
 * The bug: a planner turn emits progress frames continuously for minutes, and
 * every one of them scrolled the log back to the bottom. Scrolling up to re-read
 * a question from four turns ago was impossible — the view snapped away
 * mid-sentence, and the operator could not tell whether that was the page or
 * their trackpad.
 */

import { describe, expect, it } from "vitest";
import { atTail } from "./planner-transcript";

describe("atTail", () => {
  it("is true at the bottom", () => {
    expect(atTail({ scrollHeight: 1000, scrollTop: 800, clientHeight: 200 })).toBe(true);
  });

  it("tolerates a few pixels of slack", () => {
    // A rounded scroll position, or the half-pixel a divider costs, must not
    // read as "the operator scrolled away".
    expect(atTail({ scrollHeight: 1000, scrollTop: 780, clientHeight: 200 })).toBe(true);
  });

  it("is false once the operator has scrolled up to read", () => {
    expect(atTail({ scrollHeight: 1000, scrollTop: 400, clientHeight: 200 })).toBe(false);
  });

  it("is true when there is nothing to scroll", () => {
    // A short conversation, and the state jsdom reports for everything.
    expect(atTail({ scrollHeight: 0, scrollTop: 0, clientHeight: 0 })).toBe(true);
  });
});
