/**
 * Placeholder for the single-`EventSource` live stream (phase 3).
 *
 * Contract, decided in PLAN §4.2: the stream **invalidates, it does not store**.
 * Event names map to `queryClient.invalidateQueries({ queryKey: [entity, project] })`,
 * coalesced to at most one invalidation per entity per 400ms. The append-only event
 * log is the single exception permitted to `setQueryData`.
 *
 * The stream path and the event-name set come from `DEVDOCS/CONTRACT.md`, which does
 * not exist until phase 1, so neither is guessed here: the builder takes the path as
 * an argument and only owns base-URL joining.
 */

import { apiUrl } from "@/shared/api/client";

export const STREAM_COALESCE_MS = 400;

export function streamUrl(path: string, project: string): string {
  return apiUrl(path, { project });
}
