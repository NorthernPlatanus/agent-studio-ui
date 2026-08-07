/**
 * Query hooks for `event`. Shapes come from `src/shared/api/generated.ts`,
 * requests from `shared/api/client`, keys from `eventKeys` (project-first).
 */

export { type EventQueryParams, eventsQuery, useEvents, useEventTail } from "./event-queries";
