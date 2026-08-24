/**
 * The other half of not-following the tail.
 *
 * `atTail` (see `planner-transcript.test.ts`) pins *when* the log is allowed to
 * jump. This file pins what happens when it is not allowed to: the operator has
 * scrolled up to re-read something, the planner keeps appending, and nothing on
 * the screen says so. Holding the view still is correct — being unable to tell
 * a held view apart from a dead stream is not.
 *
 * jsdom reports zero for every scroll metric, so the container's geometry is
 * stubbed. That is the only thing faked here: the scroll event, the effect that
 * raises the notice, and the click that clears it are all the real component.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { DiscussFrame, DiscussSession } from "@/entities/discuss";
import { PlannerTranscript } from "./planner-transcript";

function frame(seq: number, kind: string, data: Record<string, unknown>): DiscussFrame {
  return { seq, ts: 1_785_000_000 + seq, kind, data };
}

function session(frames: DiscussFrame[]): DiscussSession {
  return {
    session_id: "s-1",
    project: "example",
    request: "add a project switcher",
    status: "running",
    expects: null,
    started_at: 1_785_000_000,
    last_activity_at: 1_785_000_100,
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
    frames,
  };
}

/** Makes the log look like a tall region the operator has scrolled to the top
 *  of. `writable`, not a bare value: the component assigns `scrollTop` to jump,
 *  and a non-writable stub would throw under the module's strict mode rather
 *  than record the jump. */
function scrolledUp(log: HTMLElement) {
  Object.defineProperty(log, "scrollHeight", { value: 1000, configurable: true });
  Object.defineProperty(log, "clientHeight", { value: 200, configurable: true });
  Object.defineProperty(log, "scrollTop", { value: 0, writable: true, configurable: true });
  fireEvent.scroll(log);
}

const NEWER = { name: /newer messages/i };

describe("a conversation the operator has scrolled away from", () => {
  it("says nothing until something actually arrives below the fold", async () => {
    // Scrolling up on a finished conversation is reading, not missing anything.
    // A permanent "jump to the bottom" control there is a button offering to
    // undo what the operator just deliberately did.
    const { rerender } = render(
      <PlannerTranscript session={session([frame(1, "you", { text: "hello" })])} />,
    );

    scrolledUp(screen.getByRole("region", { name: "Planner conversation" }));
    rerender(<PlannerTranscript session={session([frame(1, "you", { text: "hello" })])} />);

    expect(screen.queryByRole("button", NEWER)).not.toBeInTheDocument();
  });

  it("offers a way back once a frame lands where it cannot be seen", async () => {
    const first = [frame(1, "you", { text: "hello" })];
    const { rerender } = render(<PlannerTranscript session={session(first)} />);

    const log = screen.getByRole("region", { name: "Planner conversation" });
    scrolledUp(log);
    rerender(
      <PlannerTranscript session={session([...first, frame(2, "question", { text: "which?" })])} />,
    );

    expect(await screen.findByRole("button", NEWER)).toBeInTheDocument();
  });

  it("does not move the view while the notice is up", async () => {
    // The whole point: the arriving frame must not yank the operator out of the
    // paragraph they are reading. The notice exists *because* the jump is
    // withheld, so a jump plus a notice would be the worst of both.
    const first = [frame(1, "you", { text: "hello" })];
    const { rerender } = render(<PlannerTranscript session={session(first)} />);

    const log = screen.getByRole("region", { name: "Planner conversation" });
    scrolledUp(log);
    rerender(
      <PlannerTranscript session={session([...first, frame(2, "question", { text: "which?" })])} />,
    );

    await screen.findByRole("button", NEWER);
    expect(log.scrollTop).toBe(0);
  });

  it("goes back to the newest frame, and back to following it, on one click", async () => {
    const user = userEvent.setup();
    const first = [frame(1, "you", { text: "hello" })];
    const { rerender } = render(<PlannerTranscript session={session(first)} />);

    const log = screen.getByRole("region", { name: "Planner conversation" });
    scrolledUp(log);
    const second = [...first, frame(2, "question", { text: "which?" })];
    rerender(<PlannerTranscript session={session(second)} />);

    await user.click(await screen.findByRole("button", NEWER));
    expect(log.scrollTop).toBe(1000);
    expect(screen.queryByRole("button", NEWER)).not.toBeInTheDocument();

    // And following resumed: the next frame scrolls rather than raising the
    // notice a second time. A button that returned the view but left the
    // component un-following would go quiet again at the tail — which is the
    // one place the operator is entitled to expect the log to keep up.
    Object.defineProperty(log, "scrollHeight", { value: 1400, configurable: true });
    rerender(
      <PlannerTranscript session={session([...second, frame(3, "note", { text: "ok" })])} />,
    );
    expect(log.scrollTop).toBe(1400);
    expect(screen.queryByRole("button", NEWER)).not.toBeInTheDocument();
  });

  it("withdraws the notice when the operator scrolls back down themselves", async () => {
    const first = [frame(1, "you", { text: "hello" })];
    const { rerender } = render(<PlannerTranscript session={session(first)} />);

    const log = screen.getByRole("region", { name: "Planner conversation" });
    scrolledUp(log);
    rerender(
      <PlannerTranscript session={session([...first, frame(2, "question", { text: "which?" })])} />,
    );
    await screen.findByRole("button", NEWER);

    log.scrollTop = 800;
    fireEvent.scroll(log);

    expect(screen.queryByRole("button", NEWER)).not.toBeInTheDocument();
  });
});
