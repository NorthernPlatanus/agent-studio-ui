/**
 * The scope selector, pinned to the foot of the nav rail — the reference's
 * account block (`DEVDOCS/DESIGN.md` §3.2). Every read in the app is scoped to
 * this value, which is exactly why it sits out of the daily tab order but never
 * off screen.
 *
 * The second line is the project's readiness, because "this project has never
 * run" (409 on every read) is a state the operator needs to recognise from the
 * switcher rather than from an error on each page.
 */

import { CheckIcon, ChevronsUpDownIcon, FolderIcon } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import type { Project } from "@/entities/project";
import { cn } from "@/shared/lib/utils";
import { useActiveProject } from "./use-active-project";

function readiness(project: Project | undefined): string {
  if (!project) return "loading…";
  if (!project.has_store) return "never run";
  return project.has_checkpoints ? "store + checkpoints" : "store ready";
}

export function ProjectSwitcher({ collapsed = false }: { collapsed?: boolean }) {
  const { project, detail, projects, select } = useActiveProject();

  const trigger = (
    <DropdownMenu.Trigger
      className={cn(
        "flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors",
        "hover:bg-sidebar-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-ring",
      )}
      aria-label={`Project: ${project ?? "none"}. Switch project`}
    >
      <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-sidebar-border bg-card">
        <FolderIcon className="size-3.5 text-muted-foreground" aria-hidden="true" />
      </span>
      {collapsed ? null : (
        <>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-medium">
              {project ?? "No project"}
            </span>
            <span className="block truncate text-[11px] text-muted-foreground">
              {readiness(detail)}
            </span>
          </span>
          <ChevronsUpDownIcon
            className="size-3.5 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
        </>
      )}
    </DropdownMenu.Trigger>
  );

  return (
    <DropdownMenu.Root>
      {trigger}
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          side="top"
          align="start"
          sideOffset={6}
          className="z-50 min-w-56 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-md"
        >
          <DropdownMenu.Label className="px-2 py-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Project
          </DropdownMenu.Label>
          {projects.map((candidate) => (
            <DropdownMenu.Item
              key={candidate.name}
              onSelect={() => select(candidate.name)}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[13px] outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
            >
              <CheckIcon
                className={cn("size-3.5 shrink-0", candidate.name === project ? "" : "invisible")}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1 truncate">{candidate.name}</span>
              <span className="shrink-0 text-[11px] text-muted-foreground">
                {readiness(candidate)}
              </span>
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
