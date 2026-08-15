/**
 * The one focus indicator in this app.
 *
 * There used to be two. shadcn's own primitives (`Button`, `Input`, `Select`,
 * `Checkbox`) ring the control with a soft 3px halo in `ring/50` and tint the
 * border to match; the shell's hand-written controls drew `outline-2
 * outline-offset-2` instead — a hard opaque rule floating 2px clear of the
 * shape it belongs to. Side by side in the planner, the second reads as a
 * browser default someone forgot to style.
 *
 * So: the halo, everywhere, from here. `outline-none` is part of the token
 * because the ring replaces the UA outline rather than joining it — every
 * consumer that sets one must clear the other.
 */

/** Focus ring for a control that takes focus itself. */
export const FOCUS_RING =
  "outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

/**
 * Focus ring for a container that lights up when something inside it takes
 * focus — a composer whose textarea is borderless, so the ring belongs to the
 * whole object or the field lights up inside an inert box.
 */
export const FOCUS_RING_WITHIN =
  "outline-none focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50";
