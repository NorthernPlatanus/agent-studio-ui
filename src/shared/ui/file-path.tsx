/**
 * A repo path that elides its **head**, never its tail.
 *
 * `truncate` cuts from the right, which for a path removes the only part that
 * distinguishes it. Observed on task detail at 375px: three `Reads` entries —
 * `chase-camera/ui/FollowCamera.tsx`, `chase-camera/lib/camera.ts` and
 * `chase-camera/config.ts` — all rendered as the identical string
 * `src/features/chase-ca…`. Three different files, one visible label.
 *
 * The mechanism is the standard bidi trick rather than JS measurement: `rtl` on
 * the clipping box makes the browser overflow from the *start*, so the ellipsis
 * lands on the shared directory prefix. The inner `dir="ltr"` is what keeps the
 * path's own characters in logical order — without it a path ending in `/` or a
 * dot reorders visually, which looks like corruption.
 */

import { cn } from "@/shared/lib/utils";

export function FilePath({ path, className }: { path: string; className?: string }) {
  return (
    <span
      dir="rtl"
      title={path}
      className={cn("block truncate text-left font-mono text-xs", className)}
    >
      <span dir="ltr">{path}</span>
    </span>
  );
}
