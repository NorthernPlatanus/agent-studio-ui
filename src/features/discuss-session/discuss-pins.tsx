/**
 * Files attached to every planner turn.
 *
 * The planner already has `Read`/`Grep`/`Glob` and finds most things itself — at
 * roughly 400k input tokens of exploration per invocation, which is the single
 * largest line in this project's ledger. Attaching is the cheap override for the
 * case where it is looking in the wrong place, and the only way in for anything
 * that is not in the checkout at all: a crash log, a spec, notes from a tracker.
 * The content goes into the prompt directly, costing its own length once per
 * turn instead of a search.
 *
 * That trade only holds for small files, so the server caps each one and reports
 * `truncated` when it bit — shown here, because a silently half-read file is
 * worse than no attachment at all.
 */

import { XIcon } from "lucide-react";
import { useState } from "react";
import { MAX_PINS, type PinnedFileInfo, type UploadedPin } from "@/entities/discuss";
import { ApiError } from "@/shared/api/client";
import { Banner } from "@/shared/ui/banner";
import { Button } from "@/shared/ui/button";
import { FilePath } from "@/shared/ui/file-path";
import { Panel, PanelBody, PanelHeader } from "@/shared/ui/panel";
import { EmptyState } from "@/shared/ui/region";
import { Chip } from "@/shared/ui/status-dot";
import { PinFilePicker } from "./pin-file-picker";

function formatBytes(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : `${Math.round(bytes / 1024)} KB`;
}

export function DiscussPins({
  pins,
  disabled = false,
  pending = false,
  error,
  maxBytes,
  onUpload,
  onRemove,
}: {
  pins: readonly PinnedFileInfo[];
  disabled?: boolean;
  pending?: boolean;
  error?: unknown;
  maxBytes: number;
  onUpload: (uploads: UploadedPin[]) => void;
  onRemove: (path: string) => void;
}) {
  const [rejected, setRejected] = useState<string[]>([]);
  const total = pins.reduce((sum, pin) => sum + pin.bytes, 0);

  return (
    <Panel>
      <PanelHeader
        title="Attached files"
        meta={
          pins.length === 0
            ? "none — the planner searches for itself"
            : `${pins.length} · ${formatBytes(total)} in every turn`
        }
      />
      <PanelBody className="space-y-3">
        {/*
          No dropzone on a finished session. A disabled one is worse than none:
          it is the largest thing on the panel, it says "Choose files" in the
          middle of it, and there is no turn left for a file to be read into —
          and once the page started offering a *new* session below a finished
          one, there were two "Choose files" targets on screen, only one of
          which did anything.
        */}
        {disabled ? null : (
          <PinFilePicker
            busy={pending}
            remaining={MAX_PINS - pins.length}
            onFiles={(uploads) => {
              onUpload(uploads);
              setRejected([]);
            }}
            onReject={setRejected}
          />
        )}

        {rejected.length > 0 ? (
          <Banner tone="warn">
            <ul className="space-y-0.5">
              {rejected.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </Banner>
        ) : null}

        {error instanceof ApiError ? (
          <Banner tone="bad">
            {typeof error.detail === "string" ? error.detail : "Could not attach that file."}
          </Banner>
        ) : null}

        {pins.length === 0 ? (
          <EmptyState>
            {disabled
              ? "Nothing was attached to this session — the planner worked from the repo and the backlog alone."
              : "Attach a file when the planner needs to see something specific — it is cheaper than letting it search, it is the fix when it keeps reading the wrong tree, and it is the only way to show it something that is not in the repo."}
          </EmptyState>
        ) : (
          <ul className="space-y-1">
            {pins.map((pin) => (
              <li key={pin.path} className="flex items-center gap-2">
                <span className="min-w-0 flex-1">
                  <FilePath path={pin.path} />
                </span>
                <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
                  {formatBytes(pin.bytes)}
                </span>
                {pin.truncated ? (
                  <Chip
                    tone="warn"
                    title={`Only the first ${formatBytes(maxBytes)} is in the prompt`}
                  >
                    truncated
                  </Chip>
                ) : null}
                <Button
                  size="xs"
                  variant="ghost"
                  disabled={disabled || pending}
                  onClick={() => onRemove(pin.path)}
                  aria-label={`Remove ${pin.path}`}
                >
                  <XIcon aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </PanelBody>
    </Panel>
  );
}
