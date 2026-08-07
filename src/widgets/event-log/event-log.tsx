/**
 * The event tail. Newest first, invalidated by the live stream.
 *
 * `order=desc` is a real server affordance now, so this is one request with no
 * cursor arithmetic — see `useEventTail`.
 */

import { EventRow, newestFirst } from "@/entities/event";
import { useEventTail } from "@/entities/event/api";
import { EmptyState } from "@/shared/ui/region";
import { Skeleton } from "@/shared/ui/skeleton";

export function EventLog({
  project,
  count = 30,
  compact = false,
}: {
  project: string | null;
  count?: number;
  compact?: boolean;
}) {
  const { data, isPending, error } = useEventTail(project, count);

  if (error) return <EmptyState>Could not read the event log.</EmptyState>;
  if (isPending) {
    return (
      <div className="space-y-2 p-3">
        {[0, 1, 2, 3].map((row) => (
          <Skeleton key={row} className="h-8 w-full" />
        ))}
      </div>
    );
  }

  const events = newestFirst(data.events);
  if (events.length === 0) return <EmptyState>No events recorded yet.</EmptyState>;

  return (
    <ul className={compact ? "" : "divide-y divide-border/60"}>
      {events.map((event) => (
        <EventRow key={event.rowid} event={event} compact={compact} />
      ))}
    </ul>
  );
}
