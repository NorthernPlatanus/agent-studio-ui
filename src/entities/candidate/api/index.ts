/**
 * Query hooks for `candidate`. Candidates are addressable only through their task
 * (`…/tasks/{id}/candidates`) — there is no per-candidate endpoint. Shapes come
 * from `src/shared/api/generated.ts`, keys from `candidateKeys`.
 */

export { taskCandidatesQuery, useTaskCandidates } from "./candidate-queries";
