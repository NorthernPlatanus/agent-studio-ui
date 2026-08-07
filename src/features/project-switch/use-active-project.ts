/**
 * Which project every screen is looking at.
 *
 * The Zustand store holds the operator's *choice* (persisted); the server owns
 * the set of projects that exist and which one `ORCH_PROJECT` points at. This
 * hook is the only place those two meet: a persisted choice for a project that
 * no longer exists silently falls back rather than 404-ing every read on the
 * page (`resolveProject`).
 */

import { findProject, resolveProject } from "@/entities/project";
import { useProjects } from "@/entities/project/api";
import { useUiStore } from "@/shared/store/ui-store";

export function useActiveProject() {
  const preferred = useUiStore((state) => state.selectedProject);
  const setSelectedProject = useUiStore((state) => state.setSelectedProject);
  const query = useProjects();

  const project = resolveProject(query.data, preferred);

  return {
    /** `null` until `/api/projects` answers, or if the machine has no projects. */
    project,
    detail: findProject(query.data, project),
    projects: query.data?.projects ?? [],
    isLoading: query.isLoading,
    error: query.error,
    select: setSelectedProject,
  };
}
