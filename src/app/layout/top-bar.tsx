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
import { describeStream } from "@/shared/lib/stream-status";
import { cn } from "@/shared/lib/utils";
import { useUiStore } from "@/shared/store/ui-store";
import { StatusDot } from "@/shared/ui/status-dot";
import { ActiveRunPill } from "@/widgets/active-run";
import { routeMeta } from "./nav-config";

const ICON_BUTTON =
  "flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/** The shared shape of every floating group in the bar. */
const PILL = "flex h-8 items-center rounded-lg border border-border bg-card";

function StreamIndicator() {
  const status = useUiStore((state) => state.streamStatus);
  const { tone, label } = describeStream(status);
  return (
    <span
      className="flex items-center gap-1.5 px-2.5 text-xs text-muted-foreground"
      title={`Live stream: ${label}`}
    >
      <StatusDot tone={tone} pulse={status === "connecting"} />
      {/* Below `sm` the dot is the whole indicator. DESIGN §3.3 already says
          this readout is "two words, never a banner"; on a 375px bar even two
          words are two words too many, and the dot carries the same fact. */}
      <span className="hidden sm:inline">{label}</span>
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
    // `flex-1` rather than `shrink`: the chip is the only element in the bar
    // that grows, so it claims whatever the fixed groups leave instead of
    // sitting at its content width with room to spare (observed at 768px: 113px
    // of chip). It still shrinks — `min-w-0` plus `truncate` on the parts.
    <nav aria-label="Breadcrumb" className={cn(PILL, "min-w-0 flex-1 gap-1.5 px-3 text-[13px]")}>
      <span
        className={cn(
          // Not `shrink-0`: on a phone the section name is the first thing that
          // should give way, since the subject after it is the specific answer
          // to "where am I".
          "truncate",
          subject === null ? "font-medium" : "shrink-0 text-muted-foreground",
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
  scrolled,
}: {
  project: string | null;
  subject: string | null;
  onToggleNav: () => void;
  onToggleRail: () => void;
  railOpen: boolean;
  /** 0 at the top of the page, 1 once scrolled clear — drives the blur fade. */
  scrolled: number;
}) {
  const navigate = useNavigate();

  return (
    <header className="absolute inset-x-0 top-0 z-30 h-14">
      {/*
        The bar itself stays invisible; this layer is the blur, and its *opacity*
        is what animates. `backdrop-filter` cannot be interpolated smoothly, so
        fading a layer that carries the filter is what makes the transition
        continuous rather than a snap at some threshold.
      */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-background/70 backdrop-blur-md"
        style={{ opacity: scrolled }}
      />
      {/* A soft edge rather than a hairline: a 1px rule under a floating bar is
          exactly the slab this design removed (§3.3). */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-full h-8 bg-gradient-to-b from-background/70 to-transparent"
        style={{ opacity: scrolled }}
      />

      <div className="relative flex h-full items-center gap-2 px-3">
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

        <div className="flex shrink-0 items-center gap-2">
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
      </div>
    </header>
  );
}
