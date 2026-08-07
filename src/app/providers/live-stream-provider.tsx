/**
 * Owns the one `EventSource` for the active project and turns frames into cache
 * invalidations (PLAN §4.2).
 *
 * Coalescing matters more than it looks: the server ticks at 1 Hz and a busy run
 * changes `tasks`, `runs`, `usage` and `events` on the same tick. Without the
 * 400ms window that is four refetches per second per screen; with it, one per
 * entity per window.
 *
 * A cursor frame fires on *every* tick where the digest moved, so the digest is
 * compared against the last one seen before anything is invalidated — the server
 * only sends changes, but a reconnect replays `hello`, and re-invalidating the
 * world on every reconnect is a stampede this avoids.
 */

import { useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useEffect, useRef } from "react";
import { CURSOR_FRAMES, type CursorFrame, openStream, STREAM_COALESCE_MS } from "@/shared/api/sse";
import { useUiStore } from "@/shared/store/ui-store";

/** Frame name -> the query-key prefix it invalidates. Keys are project-first. */
const INVALIDATES: Record<CursorFrame | "events", string[]> = {
  tasks: ["task", "project"],
  runs: ["run", "project"],
  usage: ["usage", "project"],
  jobs: ["job"],
  events: ["event", "project"],
};

export function LiveStreamProvider({
  project,
  children,
}: {
  project: string | null;
  children: ReactNode;
}) {
  const queryClient = useQueryClient();
  const setStreamStatus = useUiStore((state) => state.setStreamStatus);

  // Refs, not state: these change on every tick and must never re-render the app.
  const cursors = useRef<Partial<Record<CursorFrame, string>>>({});
  const pending = useRef(new Set<string>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (project === null) {
      setStreamStatus("idle");
      return;
    }

    cursors.current = {};
    setStreamStatus("connecting");

    const flush = () => {
      timer.current = null;
      const entities = [...pending.current];
      pending.current.clear();
      for (const entity of entities) {
        void queryClient.invalidateQueries({ queryKey: [entity, project] });
      }
    };

    const schedule = (entities: readonly string[]) => {
      for (const entity of entities) pending.current.add(entity);
      if (timer.current === null) timer.current = setTimeout(flush, STREAM_COALESCE_MS);
    };

    const close = openStream(project, {
      onOpen: () => setStreamStatus("open"),
      onError: () => setStreamStatus("error"),
      onHello: (hello) => {
        setStreamStatus("open");
        // Adopt the server's cursors without refetching: the screen's own queries
        // mounted moments ago and are already current.
        for (const frame of CURSOR_FRAMES) cursors.current[frame] = hello[frame];
      },
      onCursor: (frame, { cursor }) => {
        if (cursors.current[frame] === cursor) return;
        cursors.current[frame] = cursor;
        schedule(INVALIDATES[frame]);
      },
      // Rows arrive inline, but a truncated frame is not a complete delta — the
      // only safe response is to refetch rather than append a page with holes.
      onEvents: () => schedule(INVALIDATES.events),
    });

    return () => {
      close();
      if (timer.current !== null) clearTimeout(timer.current);
      timer.current = null;
      pending.current.clear();
      setStreamStatus("closed");
    };
  }, [project, queryClient, setStreamStatus]);

  return <>{children}</>;
}
