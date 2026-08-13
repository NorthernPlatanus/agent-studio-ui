/**
 * Sending a file to the planner: a picker and a drop target.
 *
 * Both places that attach (the start form, before a session exists, and the live
 * session's panel) need the identical read-and-reject behaviour, so it lives
 * here once.
 *
 * Rejections are surfaced per file and by name. A drop of six files where one is
 * a screenshot should attach the five and say what happened to the sixth, not
 * fail silently or refuse the lot.
 */

import { PaperclipIcon } from "lucide-react";
import { useId, useState } from "react";
import { readUpload, type UploadedPin, UploadRejected } from "@/entities/discuss";
import { cn } from "@/shared/lib/utils";

export function PinFilePicker({
  id,
  disabled = false,
  busy = false,
  remaining,
  onFiles,
  onReject,
}: {
  /** Lets a caller put its own `ControlLabel` on the file input. */
  id?: string;
  disabled?: boolean;
  busy?: boolean;
  /** How many more will fit, so a drop of twenty says so rather than 422ing. */
  remaining: number;
  onFiles: (uploads: UploadedPin[]) => void;
  onReject: (messages: string[]) => void;
}) {
  const fallbackId = useId();
  const inputId = id ?? fallbackId;
  const [over, setOver] = useState(false);
  const blocked = disabled || busy || remaining <= 0;

  const take = async (files: FileList | null) => {
    if (files === null || files.length === 0) return;
    const picked = [...files];
    const rejected: string[] = [];
    const accepted: UploadedPin[] = [];
    // Clamped: a negative `remaining` would make `slice` count from the end and
    // silently take the *last* few files instead of none.
    const room = Math.max(0, remaining);

    for (const file of picked.slice(0, room)) {
      try {
        accepted.push(await readUpload(file));
      } catch (error) {
        rejected.push(
          error instanceof UploadRejected ? error.message : `${file.name} could not be read.`,
        );
      }
    }
    if (picked.length > room) {
      rejected.push(
        `Only ${room} more file${room === 1 ? "" : "s"} can be attached — the rest were not added.`,
      );
    }
    if (accepted.length > 0) onFiles(accepted);
    onReject(rejected);
  };

  return (
    // The whole box is the `<label>`, not a div wrapping one. That makes the
    // entire drop zone activate the input on click and on Enter, so the pointer
    // target and the keyboard target are the same thing the drop target is —
    // and it keeps the drag handlers off a static element with no role.
    <label
      htmlFor={inputId}
      onDragOver={(event) => {
        if (blocked) return;
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        if (blocked) return;
        event.preventDefault();
        setOver(false);
        void take(event.dataTransfer.files);
      }}
      className={cn(
        "block rounded-lg border border-dashed px-3 py-3 text-center text-[13px] transition-colors",
        over ? "border-foreground/40 bg-foreground/[0.04]" : "border-border",
        blocked ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:border-foreground/30",
      )}
    >
      <input
        id={inputId}
        type="file"
        multiple
        disabled={blocked}
        className="sr-only"
        onChange={(event) => {
          void take(event.target.files);
          // Cleared so picking the same file twice in a row still fires
          // `change` — otherwise a re-pick after a rejection looks dead.
          event.target.value = "";
        }}
      />
      <span className="inline-flex items-center gap-1.5">
        <PaperclipIcon aria-hidden="true" className="size-3.5" />
        <span className="font-medium underline underline-offset-2">Choose files</span>
        <span className="text-muted-foreground">or drop them here</span>
      </span>
      <span className="mt-1 block text-[11px] text-muted-foreground">
        {remaining <= 0
          ? "Limit reached — remove one to attach another."
          : "Text files: logs, specs, notes, markdown. Images cannot be read by the planner."}
      </span>
    </label>
  );
}
