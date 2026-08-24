/**
 * Enter sends — except when Enter is not "send".
 *
 * The composer's Enter-to-submit is right for the loop's tightest cycle and
 * wrong for one keystroke: with an IME active, Enter accepts the candidate
 * being composed. The key event fires either way, so `isComposing` is the only
 * thing that tells the two apart, and without it the first Enter of a
 * multi-byte word posts a half-typed answer to a turn that cannot be unsent.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ComposerShell } from "./composer-shell";

function shell(onSubmit: () => void, value = "こんにち") {
  return (
    <ComposerShell
      value={value}
      onChange={() => {}}
      onSubmit={onSubmit}
      placeholder="Answer the planner's question…"
      label="Your reply to the planner"
      actions={null}
    />
  );
}

describe("the composer's Enter key", () => {
  it("sends", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(shell(onSubmit));

    await user.type(screen.getByLabelText(/your reply/i), "{Enter}");

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("breaks the line instead, with shift held", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(shell(onSubmit));

    await user.type(screen.getByLabelText(/your reply/i), "{Shift>}{Enter}{/Shift}");

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("accepts an IME candidate rather than sending a half-typed answer", () => {
    const onSubmit = vi.fn();
    render(shell(onSubmit));

    // What an IME emits while a candidate is open. `userEvent` has no notion of
    // composition, so the event is dispatched directly — which is also the
    // narrowest possible statement of the rule being pinned.
    fireEvent.keyDown(screen.getByLabelText(/your reply/i), {
      key: "Enter",
      isComposing: true,
    });

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("sends on the Enter that follows the accepted candidate", () => {
    const onSubmit = vi.fn();
    render(shell(onSubmit));
    const field = screen.getByLabelText(/your reply/i);

    fireEvent.keyDown(field, { key: "Enter", isComposing: true });
    fireEvent.compositionEnd(field);
    fireEvent.keyDown(field, { key: "Enter", isComposing: false });

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
