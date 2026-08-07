/**
 * Endpoint paths, in one place. Every project-scoped read is
 * `/api/projects/{project}/…` (CONTRACT §1) and `project` is always
 * percent-encoded — the server allowlists it, but a raw name must never be able
 * to change the shape of the URL.
 */

export const PROJECTS_PATH = "/api/projects";

export function projectPath(project: string, suffix = ""): string {
  return `${PROJECTS_PATH}/${encodeURIComponent(project)}${suffix}`;
}

export function taskPath(project: string, taskId: string, suffix = ""): string {
  return projectPath(project, `/tasks/${encodeURIComponent(taskId)}${suffix}`);
}

export function runPath(project: string, runId: string): string {
  return projectPath(project, `/runs/${encodeURIComponent(runId)}`);
}
