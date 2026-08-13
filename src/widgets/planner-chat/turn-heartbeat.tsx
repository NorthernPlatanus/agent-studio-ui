/**
 * What a planner turn sounds like when you cannot see it.
 *
 * A sighted operator watching a turn gets three pulsing dots and a line of tool
 * activity that changes every second or so. Both are decorative to assistive
 * tech — the dots are `aria-hidden`, and the activity line has to be, because it
 * re-renders hundreds of times per turn and would jam the polite queue. Without
 * something in their place, a screen-reader user sends an answer and hears
 * nothing at all for between 334 and 539 seconds, which is indistinguishable
 * from a hung page.
 *
 * So the visual channel and the spoken channel carry the same facts at very
 * different rates. This is the spoken one: an opening line that sets the
 * expectation, then a reassurance every 45 seconds carrying elapsed minutes and
 * — folded in rather than announced separately — whatever the planner is
 * currently doing. Same information as the dots plus the activity line, at
 * roughly 1/100th the verbosity.
 *
 * Two details that look incidental and are not:
 *
 *   - The element is **always mounted**, even when idle. A live region injected
 *     into the DOM in the same commit as its text is missed by JAWS and NVDA
 *     often enough to be unreliable; the container has to already exist when the
 *     text changes.
 *   - The message must actually *differ* to be re-announced. The minute count
 *     does that work naturally, which is why it is in every heartbeat line and
 *     not only the ones where it changed.
 */

import { useEffect, useRef, useState } from "react";

/** How often to speak while a turn is in flight. */
const HEARTBEAT_MS = 45_000;

export function TurnHeartbeat({
  running,
  activity,
}: {
  running: boolean;
  /** The newest `progress` line, or null. Read, never subscribed to. */
  activity: string | null;
}) {
  const [message, setMessage] = useState("");
  const startedAt = useRef(0);
  // A ref so a new progress frame never restarts the interval — the whole point
  // is that the spoken cadence is decoupled from the frame rate.
  const latest = useRef(activity);
  latest.current = activity;

  useEffect(() => {
    if (!running) {
      setMessage("");
      return;
    }
    startedAt.current = Date.now();
    setMessage(
      "The planner is working. A turn usually takes five to ten minutes. " +
        "You will be told when it needs an answer.",
    );
    const id = setInterval(() => {
      const minutes = Math.max(1, Math.round((Date.now() - startedAt.current) / 60_000));
      setMessage(
        `Still working, ${minutes} minute${minutes === 1 ? "" : "s"} elapsed.` +
          (latest.current ? ` Currently ${latest.current}.` : ""),
      );
    }, HEARTBEAT_MS);
    return () => clearInterval(id);
  }, [running]);

  return (
    <p role="status" aria-live="polite" className="sr-only">
      {message}
    </p>
  );
}
