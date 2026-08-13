/**
 * A form label, laid out as **text**.
 *
 * shadcn ships this as `display: flex`, for the icon-beside-a-word case. That is
 * wrong for any label containing a sentence: a flex container makes every child
 * its own flex item, so
 *
 *   I understand this <span>spends subscription quota</span> and writes to git…
 *
 * renders as three independently-wrapping columns rather than one paragraph —
 * observed at 768px on the one checkbox gating spend and git mutation, where the
 * three text nodes came out 69px, 113px and 199px wide, each wrapped on its own.
 *
 * So the base is ordinary inline flow, and a label that really does want a row
 * of boxes asks for it with `className="flex items-center gap-2"`. The checkbox
 * rows in this app already put the flex on the wrapper, where it belongs.
 */

import { Label as LabelPrimitive } from "radix-ui";
import type * as React from "react";

import { cn } from "@/shared/lib/utils";

function Label({ className, ...props }: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        "block text-sm font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Label };
