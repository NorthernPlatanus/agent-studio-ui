/**
 * The planner chat.
 *
 * The layout is real; the transport is not — the `…/discuss` family is the one
 * part of the API that does not exist yet, so the composer and the transcript
 * are plugged rather than faked (`DEVDOCS/DESIGN.md` §3.8). What is drawn here
 * is the shape the discuss adapter has to fill: an assumption note, a question
 * with an answer box, a spec preview as cards, and the approve bar.
 */

import { SendHorizontalIcon } from "lucide-react";
import { Banner } from "@/shared/ui/banner";
import { Button } from "@/shared/ui/button";
import { Panel, PanelBody, PanelHeader } from "@/shared/ui/panel";
import { Region } from "@/shared/ui/region";
import { Screen } from "@/shared/ui/screen";
import { Soon, SoonOverlay } from "@/shared/ui/soon";
import { Chip } from "@/shared/ui/status-dot";

function Turn({ who, children }: { who: "planner" | "you"; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 w-16 shrink-0 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {who}
      </span>
      <div className="min-w-0 flex-1 text-[13px] leading-relaxed">{children}</div>
    </div>
  );
}

export function PlannerPage() {
  return (
    <Screen>
      <Banner tone="info">
        The planner loop runs against your subscription quota. Nothing here spends anything until
        the discuss endpoints land.
      </Banner>

      <Panel>
        <PanelHeader
          title="Requirements session"
          actions={<Soon title="Needs the …/discuss endpoints" />}
        />
        <SoonOverlay note="Waiting on the discuss adapter — the chat transport is not built yet.">
          <PanelBody className="space-y-5">
            <Turn who="you">Add a settings screen with a project switcher.</Turn>
            <Turn who="planner">
              <p className="mb-2 text-muted-foreground">
                <Chip>assumption</Chip> The switcher reads the existing project allowlist rather
                than adding configuration.
              </p>
              <p>Should the switcher be able to create a project, or only select one?</p>
            </Turn>
            <Turn who="you">
              <div className="flex gap-2">
                <input
                  className="h-9 flex-1 rounded-lg border border-border bg-card px-3 text-[13px]"
                  placeholder="Answer the question…"
                  readOnly
                />
                <Button size="sm" className="h-9">
                  <SendHorizontalIcon className="size-3.5" aria-hidden="true" />
                  Send
                </Button>
              </div>
            </Turn>
          </PanelBody>
        </SoonOverlay>
      </Panel>

      <Region title="Proposed specs" meta="preview before anything is written">
        <SoonOverlay note="Spec previews arrive with the planner chat.">
          <div className="grid gap-3 sm:grid-cols-2">
            {["T-140", "T-141"].map((id) => (
              <Panel key={id}>
                <PanelBody className="space-y-2">
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-xs text-muted-foreground">{id}</span>
                    <span className="text-[13px] font-medium">Project switcher in settings</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <Chip>domain frontend</Chip>
                    <Chip tone="warn">risk medium</Chip>
                    <Chip>M</Chip>
                  </div>
                </PanelBody>
              </Panel>
            ))}
          </div>
        </SoonOverlay>
      </Region>
    </Screen>
  );
}
