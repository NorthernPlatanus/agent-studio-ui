/**
 * The observed width of an element, in CSS pixels.
 *
 * Needed where a CSS container query is not enough because the *markup* has to
 * change, not just its styling — dropping a `<col>` from a `<colgroup>`, for
 * instance, which cannot be done with `display: none` without corrupting how the
 * remaining columns share the table's width.
 *
 * Returns 0 until the first measurement, so callers should treat 0 as "unknown"
 * and render their fullest layout rather than their narrowest — one frame of
 * too-wide is a scrollbar, one frame of too-narrow is a visible collapse.
 */

import { type RefObject, useEffect, useState } from "react";

export function useElementWidth(ref: RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const next = Math.round(entry.contentRect.width);
      setWidth((current) => (current === next ? current : next));
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return width;
}
