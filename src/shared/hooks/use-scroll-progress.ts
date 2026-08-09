/**
 * How far a scroll container has moved, as 0→1 over the first `distance` pixels.
 *
 * Used by the chrome to fade its blur in (`DEVDOCS/DESIGN.md` §3.3). Three
 * details that matter:
 *
 *  - the value is **quantised to 1/24ths** before it reaches React. The raw
 *    number changes on every scroll frame, and re-rendering the top bar sixty
 *    times a second to move an opacity by 0.004 is pure waste; twenty-four steps
 *    is smoother than the eye resolves on a 200ms-ish fade.
 *  - the listener is `passive`, so it can never block scrolling.
 *  - it re-reads on mount and whenever the element changes, because a route
 *    change swaps the scroll container while it may already be scrolled.
 */

import { type RefObject, useEffect, useState } from "react";

const STEPS = 24;

export function useScrollProgress(ref: RefObject<HTMLElement | null>, distance = 64): number {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const read = () => {
      const ratio = Math.min(1, Math.max(0, element.scrollTop / distance));
      const stepped = Math.round(ratio * STEPS) / STEPS;
      setProgress((current) => (current === stepped ? current : stepped));
    };

    read();
    element.addEventListener("scroll", read, { passive: true });
    return () => element.removeEventListener("scroll", read);
  }, [ref, distance]);

  return progress;
}
