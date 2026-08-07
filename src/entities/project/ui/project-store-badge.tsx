import { Badge } from "@/shared/ui/badge";
import type { Project } from "../model";

/**
 * Whether a project can be read at all. A project with no store is not broken —
 * it has simply never run, and every read against it returns 409 (CONTRACT §2).
 */
export function ProjectStoreBadge({ project }: { project: Project }) {
  if (!project.has_store) {
    return (
      <Badge variant="outline" title="No store file yet — this project has never run">
        No store
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" title={project.store_path ?? undefined}>
      {project.has_checkpoints ? "Store + checkpoints" : "Store"}
    </Badge>
  );
}
