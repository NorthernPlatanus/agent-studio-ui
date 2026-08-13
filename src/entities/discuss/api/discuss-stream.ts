/**
 * The session's own SSE stream.
 *
 * This is the one place in the panel where the stream carries *data* rather than
 * a cache-invalidation signal (PLAN §4.2), and deliberately so: the conversation
 * is append-only with a server-assigned `seq`, exactly like the event log — the
 * other documented exception. Refetching the whole session on every frame would
 * turn a typing-speed stream into a request per token-ish chunk.
 *
 * `seq` also makes reconnects free. `EventSource` retries on its own, and the
 * subscription re-opens with `?since=<highest seq seen>`, so the server replays
 * the gap rather than the operator losing whatever arrived while the laptop was
 * asleep. Without the cursor a reconnect would either duplicate the transcript
 * or silently skip it.
 */

import type { QueryClient } from "@tanstack/react-query";
import { apiUrl } from "@/shared/api/client";
import { projectPath } from "@/shared/api/paths";
import type { DiscussFrame, DiscussSession, DiscussState } from "../model";
import { discussKeys } from "../model/discuss-keys";

export function discussStreamUrl(project: string, sessionId: string, since: number): string {
  return apiUrl(projectPath(project, `/discuss/${encodeURIComponent(sessionId)}/stream`), {
    since,
  });
}

/** The frame kinds that move the session's own status. Mirrors `Session.push`. */
function statusFrom(frame: DiscussFrame, current: DiscussSession): Partial<DiscussSession> {
  switch (frame.kind) {
    case "awaiting":
      return {
        status: "awaiting",
        expects: (frame.data.expects as DiscussSession["expects"]) ?? null,
      };
    case "thinking":
      return { status: "running", expects: null };
    case "applied":
      return {
        status: "done",
        expects: null,
        applied: Array.isArray(frame.data.specs)
          ? (frame.data.specs as DiscussSession["applied"])
          : current.applied,
      };
    case "aborted":
      return { status: "aborted", expects: null };
    case "error":
      return {
        status: "failed",
        expects: null,
        error: typeof frame.data.text === "string" ? frame.data.text : current.error,
      };
    default:
      return {};
  }
}

/**
 * Folds one frame into the cached session.
 *
 * Idempotent by `seq`: the replay window on reconnect overlaps by design, and a
 * transcript that grows a duplicate question every time the network hiccups is
 * worse than one that misses a frame.
 */
export function applyFrame(session: DiscussSession, frame: DiscussFrame): DiscussSession {
  if (session.frames.some((existing) => existing.seq === frame.seq)) return session;
  return {
    ...session,
    ...statusFrom(frame, session),
    frames: [...session.frames, frame],
    last_activity_at: frame.ts,
  };
}

/**
 * Reconciles a session a mutation just returned with the one in the cache.
 *
 * The response and the stream are two connections. A mutation's response carries
 * the snapshot as of when its handler ran, so any frame the planner pushed after
 * that arrives on the stream instead — and a plain replace would roll it back
 * out of the transcript with nothing left to re-deliver it, since the stream's
 * cursor has already moved past. Folding the cache's extra frames back on top
 * through `applyFrame` also re-derives the status from them, so a response that
 * says `running` cannot undo an `awaiting` that has already landed.
 */
export function mergeSession(
  cached: DiscussSession | null | undefined,
  incoming: DiscussSession,
): DiscussSession {
  if (!cached || cached.session_id !== incoming.session_id) return incoming;
  const known = new Set(incoming.frames.map((frame) => frame.seq));
  const ahead = cached.frames.filter((frame) => !known.has(frame.seq));
  return ahead.reduce(applyFrame, incoming);
}

/**
 * Subscribes until the session closes. Returns the teardown.
 *
 * `onClosed` fires on the terminal frame so the caller can refetch once — the
 * final session carries `applied`, and the store now has specs in it that the
 * task list does not know about.
 */
export function openDiscussStream(
  queryClient: QueryClient,
  project: string,
  sessionId: string,
  { since = 0, onClosed }: { since?: number; onClosed?: () => void } = {},
): () => void {
  let cursor = since;
  let stopped = false;
  let source: EventSource | null = null;
  let retry: number | undefined;

  const connect = () => {
    if (stopped) return;
    source = new EventSource(discussStreamUrl(project, sessionId, cursor));

    source.addEventListener("message", (event) => {
      let frame: DiscussFrame;
      try {
        frame = JSON.parse((event as MessageEvent).data as string) as DiscussFrame;
      } catch {
        return;
      }
      cursor = Math.max(cursor, frame.seq);

      queryClient.setQueryData<DiscussState>(discussKeys.state(project), (current) => {
        if (!current?.session || current.session.session_id !== sessionId) return current;
        return { ...current, session: applyFrame(current.session, frame) };
      });

      if (frame.kind === "closed") {
        stopped = true;
        source?.close();
        onClosed?.();
      }
    });

    // `EventSource` retries on its own, but always to the URL it was opened
    // with — which would replay from the original cursor and duplicate whatever
    // arrived in between. Reconnecting by hand is what lets `since` advance.
    source.addEventListener("error", () => {
      if (stopped) return;
      source?.close();
      retry = window.setTimeout(connect, 1000);
    });
  };

  connect();

  return () => {
    stopped = true;
    window.clearTimeout(retry);
    source?.close();
  };
}
