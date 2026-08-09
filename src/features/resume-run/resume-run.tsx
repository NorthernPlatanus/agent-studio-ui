/**
 * Resume a paused run.
 *
 * A pause is not a failure — the usual cause is the subscription tier hitting
 * its 5h cap — and the run's checkpoint holds everything needed to carry on, so
 * this is one confirmed click rather than a flow. The server checks for a paused
 * run itself and 404s if there is none, instead of letting the child exit 1.
 */

import { PlayIcon } from "lucide-react";
import { useState } from "react";
import { describeJobError } from "@/entities/job";
import { useResumeRun } from "@/entities/job/api";
import { ApiError } from "@/shared/api/client";
import { Banner } from "@/shared/ui/banner";
import { Button } from "@/shared/ui/button";

export function ResumeRun({
  project,
  size = "sm",
}: {
  project: string | null;
  size?: "sm" | "default";
}) {
  const [armed, setArmed] = useState(false);
  const resume = useResumeRun(project);

  if (resume.data) {
    return (
      <span className="text-[12px] text-status-good">Resumed — watch the activity panel.</span>
    );
  }

  if (resume.error) {
    return (
      <Banner tone="bad" className="mt-2">
        {describeJobError(
          resume.error instanceof ApiError ? resume.error.status : 0,
          resume.error instanceof ApiError ? resume.error.detail : null,
        )}
      </Banner>
    );
  }

  // Two clicks, no dialog: the second click is the confirmation the API demands,
  // and an inline arm/confirm keeps it in the banner that explains the pause.
  return armed ? (
    <span className="inline-flex items-center gap-1.5">
      <Button
        size={size}
        onClick={() => resume.mutate({ confirm: true })}
        disabled={resume.isPending}
      >
        {resume.isPending ? "Resuming…" : "Confirm — spends quota"}
      </Button>
      <Button size={size} variant="ghost" onClick={() => setArmed(false)}>
        Cancel
      </Button>
    </span>
  ) : (
    <Button size={size} variant="outline" onClick={() => setArmed(true)}>
      <PlayIcon aria-hidden="true" />
      Resume
    </Button>
  );
}
