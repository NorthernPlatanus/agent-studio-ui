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
 *
 * **The element is allowed to arrive late.** The observer used to be set up in
 * an effect keyed on the ref object, which is stable for the life of the
 * component — so if `ref.current` was still null the first time that effect ran,
 * nothing was ever observed and the width stayed 0 for good. Today's only caller
 * renders its wrapper unconditionally and never hits it; a caller that returns a
 * skeleton before the measured element exists does, silently, and gets a layout
 * frozen in whatever "unmeasured" means for it. That is not a failure worth
 * leaving in a shared hook to be rediscovered.
 *
 * Note what this still cannot promise: `ResizeObserver` delivers per animation
 * frame, so a page mounted in a background tab measures nothing until it is
 * looked at. Fine for choosing table columns. Not fine for deciding whether a
 * second column fits — that belongs in a container query, which cannot be late.
 */

import { type RefObject, useEffect, useState } from "react";

export function useElementWidth(ref: RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0);
  // The observed node, as state rather than as the ref itself — mutating a ref
  // does not re-run an effect, and the node's *identity* is exactly what the
  // observer effect below has to depend on.
  const [node, setNode] = useState<HTMLElement | null>(null);

  // Deliberately dependency-free: it runs after every render and does nothing
  // unless the ref now points somewhere else, which is the only way to notice
  // an element that mounted in a later render than this hook did.
  useEffect(() => {
    setNode((current) => (current === ref.current ? current : ref.current));
  });

  useEffect(() => {
    if (!node) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const next = Math.round(entry.contentRect.width);
      setWidth((current) => (current === next ? current : next));
    });

    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);

  return width;
}
