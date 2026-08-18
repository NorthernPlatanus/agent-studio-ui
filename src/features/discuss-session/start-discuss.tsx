/**
 * Opening a planning conversation — the composer when nothing is live.
 *
 * It renders **inside** the chat panel rather than as a panel of its own, and
 * that placement is the fix for the page's worst defect: the screen used to show
 * this form only when there was no session at all, so the moment one ended the
 * planner page became a read-only report with nothing to type into and no way to
 * start again short of restarting the API. One column, transcript above,
 * something to send below, in every state.
 *
 * **The confirmation checkbox is gone.** It was an amber box carrying "I
 * understand this spends subscription quota", and it was the loudest thing on
 * the screen — the eye landed on a disclaimer before it found the field. Three
 * problems with that, beyond the tone. It sat between the field and the button,
 * so the commitment step was not the commitment control. It made the only action
 * on an empty screen render disabled, which reads as broken rather than gated.
 * And it was theatre: the operator who types a paragraph about what they want
 * built has already decided, and a checkbox they tick every single time stops
 * being read by the second session. The cost is now a plain figure beside the
 * button — `DESIGN.md` §2's rule that computed feedback sits adjacent to the
 * input that produces it, which is what it always should have been.
 *
 * What is *not* removed: `confirm` is still a required field on
 * `POST …/discuss` and the client still sends it. The server's gate is intact;
 * this only stops asking the operator to affirm the same sentence twice.
 *
 * A session takes the project's single-writer slot — it writes the transcript,
 * the usage rows, and the specs themselves on approval — so a job in flight
 * blocks it, stated as the job, because that is what the operator stops.
 */

import { ArrowUpIcon, PaperclipIcon, XIcon } from "lucide-react";
import { type ReactNode, useState } from "react";
import { MAX_PINS, type UploadedPin, uploadDisplayPath } from "@/entities/discuss";
import { describeJobError } from "@/entities/job";
import { ApiError } from "@/shared/api/client";
import { Banner } from "@/shared/ui/banner";
import { Button } from "@/shared/ui/button";
import { FilePath } from "@/shared/ui/file-path";
import { ComposerShell } from "./composer-shell";
import { PinFilePicker } from "./pin-file-picker";

export function StartDiscuss({
  heading = "What do you want built?",
  blockedByJob,
  runnable,
  runnableDetail,
  pending,
  error,
  context,
  onStart,
}: {
  /** Differs once a finished conversation is on screen above this form. */
  heading?: string;
  /** The command of a job holding the write slot, if any. */
  blockedByJob: string | null;
  runnable: boolean;
  runnableDetail?: string | null | undefined;
  pending: boolean;
  error: unknown;
  /** What this session will actually run against — the planner's configured
   *  model and the checkout it reads. Placed under the field rather than in a
   *  caption above it: it is state, and it is the answer to the only question
   *  an operator has before pressing the button. */
  context?: ReactNode;
  onStart: (request: string, confirm: boolean, uploads: UploadedPin[]) => void;
}) {
  const [request, setRequest] = useState("");
  // Staged, not sent: there is no session yet to attach *to*. They are read
  // here and re-validated server-side, since a client is not a gate.
  const [uploads, setUploads] = useState<UploadedPin[]>([]);
  const [rejected, setRejected] = useState<string[]>([]);
  // The picker is behind a toggle rather than a `Disclosure`: most sessions
  // attach nothing, and a second folded heading under the field was one of the
  // four identically-weighted uppercase rows this screen used to open with.
  const [attaching, setAttaching] = useState(false);

  const blocked = blockedByJob !== null || !runnable;
  const ready = !blocked && !pending && request.trim() !== "";

  const addUploads = (next: UploadedPin[]) =>
    setUploads((current) => {
      // Last write wins on a repeated name, matching what the server does when
      // the same display path is attached twice.
      const merged = new Map(current.map((upload) => [upload.name, upload]));
      for (const upload of next) merged.set(upload.name, upload);
      return [...merged.values()];
    });

  return (
    <div className="mx-auto w-full max-w-[38rem] space-y-3">
      <h2 className="text-[15px] font-medium tracking-tight">{heading}</h2>

      {!runnable ? (
        <Banner tone="bad">
          This project has no checkout, so the planner has nothing to read.
          <span className="ml-1 text-muted-foreground">{runnableDetail}</span>
        </Banner>
      ) : blockedByJob !== null ? (
        <Banner tone="warn">
          A <span className="font-medium">{blockedByJob}</span> job is running. A planning session
          writes to the same store, so only one of them runs at a time — stop the job from the
          activity panel, or wait.
        </Banner>
      ) : null}

      <ComposerShell
        value={request}
        onChange={setRequest}
        onSubmit={() => {
          if (ready) onStart(request.trim(), true, uploads);
        }}
        placeholder="Describe the change, feature or bug. The planner asks about what it cannot infer."
        disabled={blocked}
        rows={3}
        label="Opening message"
        actions={
          <>
            {/*
              Attaching belongs on THIS form, not only on the live session's
              panel. The first turn is the expensive one — the planner's opening
              call is the repo sweep — and an attachment is the one lever that
              aims it. One added after the answer comes back has already missed
              the turn it was for.
            */}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={blocked || pending}
              aria-expanded={attaching}
              onClick={() => setAttaching((open) => !open)}
            >
              <PaperclipIcon aria-hidden="true" />
              {uploads.length > 0 ? `${uploads.length} attached` : "Attach"}
            </Button>

            <Button type="submit" size="sm" disabled={!ready}>
              <ArrowUpIcon aria-hidden="true" />
              {pending ? "Starting…" : "Start session"}
            </Button>
          </>
        }
      />

      {context ?? null}

      {attaching || uploads.length > 0 || rejected.length > 0 ? (
        <div className="space-y-2">
          {attaching ? (
            <PinFilePicker
              id="discuss-attach"
              disabled={blocked}
              busy={pending}
              remaining={MAX_PINS - uploads.length}
              onFiles={(next) => {
                addUploads(next);
                setRejected([]);
              }}
              onReject={setRejected}
            />
          ) : null}

          {rejected.length > 0 ? (
            <Banner tone="warn">
              <ul className="space-y-0.5">
                {rejected.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            </Banner>
          ) : null}

          {uploads.length > 0 ? (
            <ul className="space-y-1">
              {uploads.map((upload) => (
                <li key={upload.name} className="flex items-center gap-2">
                  <span className="min-w-0 flex-1">
                    <FilePath path={uploadDisplayPath(upload.name)} />
                  </span>
                  <Button
                    size="xs"
                    variant="ghost"
                    disabled={pending}
                    onClick={() =>
                      setUploads((current) => current.filter((u) => u.name !== upload.name))
                    }
                    aria-label={`Remove ${upload.name}`}
                  >
                    <XIcon aria-hidden="true" />
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <Banner tone="bad">
          {describeJobError(
            error instanceof ApiError ? error.status : 0,
            error instanceof ApiError ? error.detail : null,
          )}
        </Banner>
      ) : null}
    </div>
  );
}
