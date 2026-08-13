/**
 * Reads and writes for the planner chat.
 *
 * One query and five mutations, and every mutation returns the whole session —
 * so each one ends by writing the server's answer straight into the cache rather
 * than invalidating and waiting for a round trip. That matters here more than
 * elsewhere: the operator sends an answer and the very next thing they should
 * see is the composer disabled and "planner is working", not a stale question
 * with an enabled send button for another 200ms.
 *
 * Live frames arrive over the session's own SSE stream (`discuss-stream.ts`),
 * not the project stream: this conversation is not a cache-invalidation signal,
 * it *is* the data, and it is append-only with a replay cursor.
 */

import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { projectPath } from "@/shared/api/paths";
import type {
  DiscussSession,
  DiscussSettings,
  DiscussState,
  StartDiscussRequest,
  UploadedPin,
} from "../model";
import { discussKeys } from "../model/discuss-keys";
import { mergeSession } from "./discuss-stream";

function discussPath(project: string, suffix = ""): string {
  return projectPath(project, `/discuss${suffix}`);
}

function sessionPath(project: string, sessionId: string, suffix = ""): string {
  return discussPath(project, `/${encodeURIComponent(sessionId)}${suffix}`);
}

export function discussStateQuery(project: string) {
  return queryOptions({
    queryKey: discussKeys.state(project),
    // Always the full frame log (`since: 0`): the cache holds one snapshot and a
    // partial reply would replace a complete conversation with its own tail.
    // The stream is what makes this cheap — this query runs on load and on
    // mutation, not on a timer.
    queryFn: ({ signal }) => api.get<DiscussState>(discussPath(project), { signal }),
  });
}

export function useDiscussState(project: string | null) {
  return useQuery({ ...discussStateQuery(project ?? ""), enabled: project !== null });
}

/**
 * Writes a session the server just returned into the cache.
 *
 * Kept as one function because every mutation here needs it and each doing its
 * own `setQueryData` is how two of them end up disagreeing about the shape.
 *
 * Not a plain replace — see `mergeSession` for what a replace would lose.
 */
function useSessionWriter(project: string) {
  const queryClient = useQueryClient();
  return (incoming: DiscussSession) => {
    queryClient.setQueryData<DiscussState>(discussKeys.state(project), (current) =>
      current ? { ...current, session: mergeSession(current.session, incoming) } : current,
    );
  };
}

/** Opens a session. Spends planner tokens on its first turn, so it is confirmed. */
export function useStartDiscuss(project: string | null) {
  const key = project ?? "";
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: StartDiscussRequest) => api.post<DiscussSession>(discussPath(key), body),
    onSuccess: (session) => {
      queryClient.setQueryData<DiscussState>(discussKeys.state(key), (current) =>
        current ? { ...current, session } : current,
      );
      // A session takes the project's single-writer slot, so the job list's
      // "can I start something" answer just changed.
      void queryClient.invalidateQueries({ queryKey: ["job", key] });
    },
  });
}

/** Answers the pending question, or decides at the preview (`y`/`edit`/`abort`). */
export function useDiscussReply(project: string | null, sessionId: string | undefined) {
  const key = project ?? "";
  const write = useSessionWriter(key);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (text: string) =>
      api.post<DiscussSession>(sessionPath(key, sessionId ?? "", "/reply"), { text }),
    onSuccess: (session) => {
      write(session);
      // An approved preview writes specs to the store — the task list is stale
      // the moment the loop returns.
      if (session.status === "done") {
        void queryClient.invalidateQueries({ queryKey: ["task", key] });
        void queryClient.invalidateQueries({ queryKey: ["project", key] });
      }
    },
  });
}

export function useDiscussSettings(project: string | null, sessionId: string | undefined) {
  const key = project ?? "";
  const write = useSessionWriter(key);
  return useMutation({
    mutationFn: (body: DiscussSettings) =>
      api.post<DiscussSession>(sessionPath(key, sessionId ?? "", "/settings"), body),
    onSuccess: write,
  });
}

/**
 * Attaches content the operator sent from their machine.
 *
 * The file is read to text in the browser and posted as JSON rather than as a
 * multipart body, so this and the staged-at-start case use one mechanism — see
 * `UploadedPin` for why the create request has to be able to carry attachments.
 *
 * A whole drop goes through **one** mutation, posted one file at a time. Firing
 * a mutation per file instead would leave several in flight writing the same
 * cache entry, and each response carries the full pin list as of when the server
 * handled it — so the *earliest* response landing last would drop every
 * attachment after the first until something refetched. Sequential also keeps
 * per-file validation: a rejected third file does not discard the first two.
 */
export function useUploadPin(project: string | null, sessionId: string | undefined) {
  const key = project ?? "";
  const write = useSessionWriter(key);
  return useMutation({
    mutationFn: async (uploads: readonly UploadedPin[]) => {
      let session: DiscussSession | undefined;
      for (const upload of uploads) {
        session = await api.post<DiscussSession>(
          sessionPath(key, sessionId ?? "", "/pins"),
          upload,
        );
      }
      return session;
    },
    onSuccess: (session) => {
      if (session !== undefined) write(session);
    },
  });
}

export function useRemovePin(project: string | null, sessionId: string | undefined) {
  const key = project ?? "";
  const write = useSessionWriter(key);
  return useMutation({
    mutationFn: (path: string) =>
      api.post<DiscussSession>(sessionPath(key, sessionId ?? "", "/pins/remove"), { path }),
    onSuccess: write,
  });
}

/** Aborts and closes. The transcript is persisted server-side, so history survives. */
export function useCloseDiscuss(project: string | null, sessionId: string | undefined) {
  const key = project ?? "";
  const write = useSessionWriter(key);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete<DiscussSession>(sessionPath(key, sessionId ?? "")),
    onSuccess: (session) => {
      write(session);
      void queryClient.invalidateQueries({ queryKey: ["job", key] });
    },
  });
}
