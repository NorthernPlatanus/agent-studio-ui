/**
 * Register backlog stubs from the project's markdown.
 *
 * The one free action: no LLM, no confirmation, no tokens. It still needs a
 * checkout, because `make_backlog` resolves the backlog file against it — which
 * is why all four spawners share that precondition.
 *
 * This is also how a never-run project gets a store, so it is the action the
 * "this project has never run" empty state points at.
 */

import { DownloadIcon } from "lucide-react";
import { describeJobError } from "@/entities/job";
import { useImportBacklog } from "@/entities/job/api";
import { ApiError } from "@/shared/api/client";
import { Banner } from "@/shared/ui/banner";
import { Button } from "@/shared/ui/button";

export function ImportBacklog({
  project,
  size = "sm",
}: {
  project: string | null;
  size?: "sm" | "default";
}) {
  const importBacklog = useImportBacklog(project);

  return (
    <span className="inline-flex flex-col gap-2">
      <Button
        size={size}
        variant="outline"
        onClick={() => importBacklog.mutate()}
        disabled={importBacklog.isPending}
        className="self-start"
      >
        <DownloadIcon aria-hidden="true" />
        {importBacklog.isPending ? "Importing…" : "Import backlog"}
      </Button>
      {importBacklog.error ? (
        <Banner tone="bad">
          {describeJobError(
            importBacklog.error instanceof ApiError ? importBacklog.error.status : 0,
            importBacklog.error instanceof ApiError ? importBacklog.error.detail : null,
          )}
        </Banner>
      ) : null}
      {importBacklog.data ? (
        <span className="text-[12px] text-status-good">
          Import started — the task list will fill in as it lands.
        </span>
      ) : null}
    </span>
  );
}
