/**
 * Opening a planning conversation — the chat's composer when nothing is live.
 *
 * It renders **inside** the chat panel rather than as a panel of its own, and
 * that placement is the fix for the page's worst defect: the screen used to show
 * this form only when there was no session at all, so the moment one ended the
 * planner page became a read-only report with nothing to type into and no way to
 * start again short of restarting the API. One column, transcript above,
 * something to send below, in every state.
 *
 * Confirm-gated like `plan`, and for the same reason: the very first turn is a
 * real planner call, measured at 385–425k input tokens against the subscription
 * tier. "It's only a chat" is exactly the intuition that makes this the one
 * spending control an operator would otherwise click without thinking.
 *
 * A session also takes the project's single-writer slot — it writes the
 * transcript, the usage rows, and the specs themselves on approval — so a job in
 * flight blocks it, stated as the job, because that is what the operator stops.
 */

import { MessagesSquareIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { MAX_PINS, type UploadedPin, uploadDisplayPath } from "@/entities/discuss";
import { describeJobError } from "@/entities/job";
import { ApiError } from "@/shared/api/client";
import { cn } from "@/shared/lib/utils";
import { Banner } from "@/shared/ui/banner";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { CONTROL } from "@/shared/ui/control";
import { Disclosure } from "@/shared/ui/disclosure";
import { FilePath } from "@/shared/ui/file-path";
import { Label } from "@/shared/ui/label";
import { SectionHeading } from "@/shared/ui/region";
import { PinFilePicker } from "./pin-file-picker";

export function StartDiscuss({
  heading = "Start a planning session",
  blockedByJob,
  runnable,
  runnableDetail,
  pending,
  error,
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
  onStart: (request: string, confirm: boolean, uploads: UploadedPin[]) => void;
}) {
  const [request, setRequest] = useState("");
  const [confirm, setConfirm] = useState(false);
  // Staged, not sent: there is no session yet to attach *to*. They are read
  // here and re-validated server-side, since a client is not a gate.
  const [uploads, setUploads] = useState<UploadedPin[]>([]);
  const [rejected, setRejected] = useState<string[]>([]);

  const blocked = blockedByJob !== null || !runnable;

  const addUploads = (next: UploadedPin[]) =>
    setUploads((current) => {
      // Last write wins on a repeated name, matching what the server does when
      // the same display path is attached twice.
      const merged = new Map(current.map((upload) => [upload.name, upload]));
      for (const upload of next) merged.set(upload.name, upload);
      return [...merged.values()];
    });

  return (
    <div className="space-y-3">
      <SectionHeading meta="multi-turn, with the tech-lead planner">{heading}</SectionHeading>
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

      <textarea
        rows={3}
        value={request}
        disabled={blocked || pending}
        onChange={(event) => setRequest(event.target.value)}
        placeholder="What do you want built? The planner will ask about anything it cannot infer."
        aria-label="Opening message"
        className={cn(CONTROL, "h-auto w-full resize-y py-2 leading-relaxed")}
      />

      {/*
        Attaching belongs on THIS form, not only on the live session's panel.
        The first turn is the expensive one — the planner's opening call is the
        385–425k-token repo sweep — and an attachment is the one lever that aims
        it. One added after the answer comes back has already missed the turn it
        was for.

        Folded, because most sessions attach nothing and the message box is the
        thing an operator came here to use. It unfolds itself the moment a file
        is staged, so a drop can never land somewhere the operator cannot see.
      */}
      <Disclosure
        title="Attach files"
        meta={
          uploads.length > 0
            ? `${uploads.length} staged`
            : "cheaper than letting the planner search"
        }
        defaultOpen={uploads.length > 0 || rejected.length > 0}
      >
        <div className="space-y-2">
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

          {rejected.length > 0 ? (
            <Banner tone="warn">
              <ul className="space-y-0.5">
                {rejected.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            </Banner>
          ) : null}

          <p className="text-[12px] text-muted-foreground">
            Whatever you attach is read into <span className="font-medium">every</span> turn of the
            prompt. It is cheaper than letting the planner search, it is the fix when it keeps
            reading the wrong tree, and it is the only way to show it something that is not in the
            repo.
          </p>

          {uploads.length > 0 ? (
            <ul className="space-y-1 pt-0.5">
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
      </Disclosure>

      <div className="flex items-start gap-2.5 rounded-lg border border-status-warn/35 bg-status-warn/5 px-3.5 py-2.5">
        <Checkbox
          id="discuss-confirm"
          checked={confirm}
          disabled={blocked}
          onCheckedChange={(value) => setConfirm(value === true)}
          className="mt-0.5"
        />
        <Label htmlFor="discuss-confirm" className="text-[13px] font-normal leading-relaxed">
          I understand each turn <span className="font-medium">spends subscription quota</span> — a
          planner call reads the backlog and the repo, and has measured at 385–425k input tokens.
        </Label>
      </div>

      {error ? (
        <Banner tone="bad">
          {describeJobError(
            error instanceof ApiError ? error.status : 0,
            error instanceof ApiError ? error.detail : null,
          )}
        </Banner>
      ) : null}

      <Button
        onClick={() => onStart(request.trim(), confirm, uploads)}
        disabled={blocked || !confirm || pending || request.trim() === ""}
      >
        <MessagesSquareIcon aria-hidden="true" />
        {pending ? "Starting…" : "Start session"}
      </Button>
    </div>
  );
}
