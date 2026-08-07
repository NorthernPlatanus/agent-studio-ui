import { formatClock, humanize } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";
import { Chip, type Tone } from "@/shared/ui/status-dot";
import { eventTone, type StudioEvent } from "../model";

const TONE: Readonly<Record<string, Tone>> = {
  neutral: "neutral",
  good: "good",
  bad: "bad",
};

export function EventKindBadge({ kind }: { kind: string }) {
  return (
    <Chip tone={TONE[eventTone(kind)] ?? "neutral"} className="font-mono">
      {kind}
    </Chip>
  );
}

/**
 * One log line, at two densities.
 *
 * `compact` is the context rail: time, kind, task, and the first line of detail
 * truncated — a feed you scan, not read. The full row preformats `detail`,
 * because it is free-form orchestrator output (gate logs, review JSON) that is
 * routinely multi-line and must not stretch the page.
 */
export function EventRow({
  event,
  showTask = true,
  compact = false,
}: {
  event: StudioEvent;
  showTask?: boolean;
  compact?: boolean;
}) {
  const time = (
    <time
      dateTime={new Date(event.ts * 1000).toISOString()}
      className="shrink-0 font-mono text-[11px] text-muted-foreground"
    >
      {formatClock(event.ts)}
    </time>
  );

  if (compact) {
    const firstLine = event.detail?.split("\n")[0] ?? "";
    return (
      <li className="flex flex-col gap-1 border-b border-border/50 px-3 py-2 last:border-b-0">
        <div className="flex items-center gap-2">
          {time}
          <EventKindBadge kind={event.kind} />
          {showTask && event.task_id ? (
            <span className="ml-auto shrink-0 font-mono text-[11px] text-muted-foreground">
              {event.task_id}
            </span>
          ) : null}
        </div>
        {firstLine === "" ? null : (
          <p className="truncate text-[12px] text-foreground/80" title={event.detail ?? undefined}>
            {firstLine}
          </p>
        )}
      </li>
    );
  }

  return (
    <li className={cn("flex flex-col gap-1 border-b border-border/60 py-2 last:border-b-0")}>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {time}
        <EventKindBadge kind={event.kind} />
        {showTask && event.task_id ? (
          <span className="font-mono text-foreground">{event.task_id}</span>
        ) : null}
        <span className="sr-only">{humanize(event.kind)}</span>
      </div>
      {event.detail ? (
        <pre className="max-h-32 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted/50 p-2 text-xs leading-relaxed text-foreground/90">
          {event.detail}
        </pre>
      ) : null}
    </li>
  );
}
