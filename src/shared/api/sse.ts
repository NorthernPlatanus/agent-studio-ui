/**
 * The single-`EventSource` live stream.
 *
 * Contract (PLAN §4.2, and `DECISIONS.md` 2026-08-07 "the SSE stream pushes rows
 * for `events` only"): **the stream invalidates, it does not store.** Named
 * frames map to `invalidateQueries`, coalesced. The event log is the one
 * exception permitted to write into the cache, because it is append-only.
 *
 * Two things the server's design makes load-bearing here:
 *  - cursors are **opaque digests**. They are compared for equality and never
 *    parsed; a changed cursor is the whole message.
 *  - a `StreamEvents` frame may be `truncated`, meaning the burst hit the
 *    server's per-frame cap. That frame is not a complete delta, so appending it
 *    would silently lose rows — refetch instead.
 */

import { apiUrl } from "@/shared/api/client";
import type { components } from "@/shared/api/generated";

export const STREAM_COALESCE_MS = 400;

export type StreamHello = components["schemas"]["StreamHello"];
export type StreamCursor = components["schemas"]["StreamCursor"];
export type StreamEvents = components["schemas"]["StreamEvents"];
export type StreamHeartbeat = components["schemas"]["StreamHeartbeat"];

/** Frame names the server emits. `hello` arrives once, first. */
export const CURSOR_FRAMES = ["tasks", "runs", "usage", "jobs"] as const;
export type CursorFrame = (typeof CURSOR_FRAMES)[number];

export function streamUrl(project: string): string {
  return apiUrl(`/api/projects/${encodeURIComponent(project)}/stream`);
}

export interface StreamHandlers {
  onHello?: (payload: StreamHello) => void;
  onCursor?: (frame: CursorFrame, payload: StreamCursor) => void;
  onEvents?: (payload: StreamEvents) => void;
  onHeartbeat?: (payload: StreamHeartbeat) => void;
  onOpen?: () => void;
  onError?: () => void;
}

/**
 * Opens the stream and wires the named frames. Returns the teardown.
 *
 * `EventSource` reconnects on its own, and the server replays `hello` with fresh
 * cursors when it does — which is why a reconnect needs no bookkeeping here.
 */
export function openStream(project: string, handlers: StreamHandlers): () => void {
  const source = new EventSource(streamUrl(project));

  const parse = <T>(event: MessageEvent): T | null => {
    try {
      return JSON.parse(event.data as string) as T;
    } catch {
      return null;
    }
  };

  source.addEventListener("open", () => handlers.onOpen?.());
  source.addEventListener("error", () => handlers.onError?.());

  source.addEventListener("hello", (event) => {
    const payload = parse<StreamHello>(event as MessageEvent);
    if (payload) handlers.onHello?.(payload);
  });

  source.addEventListener("events", (event) => {
    const payload = parse<StreamEvents>(event as MessageEvent);
    if (payload) handlers.onEvents?.(payload);
  });

  source.addEventListener("heartbeat", (event) => {
    const payload = parse<StreamHeartbeat>(event as MessageEvent);
    if (payload) handlers.onHeartbeat?.(payload);
  });

  for (const frame of CURSOR_FRAMES) {
    source.addEventListener(frame, (event) => {
      const payload = parse<StreamCursor>(event as MessageEvent);
      if (payload) handlers.onCursor?.(frame, payload);
    });
  }

  return () => source.close();
}
