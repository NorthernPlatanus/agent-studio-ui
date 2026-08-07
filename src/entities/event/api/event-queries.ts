import { queryOptions, useQuery } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { projectPath } from "@/shared/api/paths";
import type { Events } from "../model";
import { eventKeys } from "../model/event-keys";

/** Exactly the query params `…/events` documents. */
export type EventQueryParams = {
  since_rowid?: number;
  kind?: string;
  task_id?: string;
  run_id?: string;
  limit?: number;
  /** `asc` pages forward from `since_rowid`; `desc` returns the newest rows. */
  order?: "asc" | "desc";
};

export function eventsQuery(project: string, params: EventQueryParams = {}) {
  return queryOptions({
    queryKey: eventKeys.list(project, params),
    queryFn: ({ signal }) =>
      api.get<Events>(projectPath(project, "/events"), { query: params, signal }),
  });
}

export function useEvents(project: string | null, params: EventQueryParams = {}) {
  return useQuery({ ...eventsQuery(project ?? "", params), enabled: project !== null });
}

/**
 * The newest `count` events.
 *
 * This used to need a workaround — the endpoint only paged forward from the
 * oldest row, so the dashboard had to subtract from `Summary.max_event_rowid` and
 * accept an approximation under filters. `order=desc` landed server-side on
 * 2026-08-07 (`DECISIONS.md`) and this is the direct call it replaces it with;
 * `next_since_rowid` is the highest rowid in the page in **both** orders, so a
 * poller that switches order still moves forward.
 */
export function useEventTail(
  project: string | null,
  count = 20,
  filters: Pick<EventQueryParams, "kind" | "task_id" | "run_id"> = {},
) {
  return useEvents(project, { ...filters, limit: count, order: "desc" });
}
