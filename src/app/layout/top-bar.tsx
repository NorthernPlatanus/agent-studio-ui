/**
 * Chrome that carries state and location (`DEVDOCS/DESIGN.md` §3.3).
 *
 * The bar itself has no fill and no bottom border — what you see are floating
 * pill groups, the way the reference groups `← →` into one container and
 * `FAQ · Documentation · Support` into a single pill. Related controls share one
 * pill with interior separators rather than each getting its own box.
 *
 * The location chip is what replaces every page `<h1>` and its explanatory
 * subtitle: the page says where you are once, in a fixed spot, and the content
 * area starts with content. Back/forward earn their place because the common
 * path through this app is a drill-down (dashboard → task → run → task).
 */

import { ArrowLeftIcon, ArrowRightIcon, PanelLeftIcon, PanelRightIcon } from "lucide-react";
import { useLocation, useNavigate } from "react-router";
import { cn } from "@/shared/lib/utils";
import { useUiStore } from "@/shared/store/ui-store";
import { StatusDot, type Tone } from "@/shared/ui/status-dot";
import { ActiveRunPill } from "@/widgets/active-run";
import { routeMeta } from "./nav-config";

const ICON_BUTTON =
  "flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/** The shared shape of every floating group in the bar. */
const PILL = "flex h-8 items-center rounded-lg border border-border bg-card";

const STREAM_TONE: Record<string, Tone> = {
  open: "good",
  connecting: "warn",
  error: "bad",
  closed: "neutral",
  idle: "neutral",
};

const STREAM_LABEL: Record<string, string> = {
  open: "Live",
  connecting: "Connecting",
  error: "Stream down",
  closed: "Offline",
  idle: "Offline",
};

function StreamIndicator() {
  const status = useUiStore((state) => state.streamStatus);
  return (
    <span
      className="flex items-center gap-1.5 px-2.5 text-xs text-muted-foreground"
      title={`Live stream: ${STREAM_LABEL[status] ?? status}`}
    >
      <StatusDot tone={STREAM_TONE[status] ?? "neutral"} pulse={status === "connecting"} />
      {STREAM_LABEL[status] ?? status}
    </span>
  );
}

/**
 * The current object, not the current page. On a detail route the trailing
 * segment is the object itself, resolved by the layout.
 */
function LocationChip({ subject }: { subject: string | null }) {
  const { pathname } = useLocation();
  const { section } = routeMeta(pathname);
  return (
    // A breadcrumb landmark, not a decorative label: with no page `<h1>`
    // anywhere in the app, this is the only thing that answers "where am I" for
    // a screen reader as well as for an eye.
    <nav aria-label="Breadcrumb" className={cn(PILL, "min-w-0 shrink gap-1.5 px-3 text-[13px]")}>
      <span
        className={cn(
          "shrink-0 truncate",
          subject === null ? "font-medium" : "text-muted-foreground",
        )}
      >
        {section}
      </span>
      {subject === null ? null : (
        <>
          <span className="shrink-0 text-border">/</span>
          <span className="truncate font-medium">{subject}</span>
        </>
      )}
    </nav>
  );
}

export function TopBar({
  project,
  subject,
  onToggleNav,
  onToggleRail,
  railOpen,
}: {
  project: string | null;
  subject: string | null;
  onToggleNav: () => void;
  onToggleRail: () => void;
  railOpen: boolean;
}) {
  const navigate = useNavigate();

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 px-3">
      <button
        type="button"
        onClick={onToggleNav}
        className={ICON_BUTTON}
        aria-label="Toggle navigation"
      >
        <PanelLeftIcon className="size-4" aria-hidden="true" />
      </button>

      <div className={cn(PILL, "hidden gap-px p-0.5 sm:flex")}>
        <button
          type="button"
          onClick={() => void navigate(-1)}
          className={cn(ICON_BUTTON, "size-6")}
          aria-label="Back"
        >
          <ArrowLeftIcon className="size-3.5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => void navigate(1)}
          className={cn(ICON_BUTTON, "size-6")}
          aria-label="Forward"
        >
          <ArrowRightIcon className="size-3.5" aria-hidden="true" />
        </button>
      </div>

      <LocationChip subject={subject} />

      <div className="ml-auto flex shrink-0 items-center gap-2">
        {/* Stream health and run state share one pill: they answer the same
            question — is this panel telling me the truth right now. */}
        <div className={cn(PILL, "divide-x divide-border")}>
          <StreamIndicator />
          <ActiveRunPill project={project} />
        </div>
        <button
          type="button"
          onClick={onToggleRail}
          className={cn(ICON_BUTTON, railOpen && "bg-foreground/5 text-foreground")}
          aria-label="Toggle activity panel"
          aria-pressed={railOpen}
        >
          <PanelRightIcon className="size-4" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
