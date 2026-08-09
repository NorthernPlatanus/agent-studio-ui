/**
 * The task table's filter bar — floating control pills, not a bordered toolbar
 * (`DEVDOCS/DESIGN.md` §3.3).
 *
 * The URL is what the nav rail's pre-filtered children link to, so it has to be
 * a real input to this component rather than a nicety: `/tasks?status=ready`
 * must arrive filtered, and touching a control must leave a link you can share.
 * The Zustand store keeps the filters that have no server param.
 */

import { XIcon } from "lucide-react";
import { useEffect } from "react";
import { useSearchParams } from "react-router";
import { TASK_COMPLEXITIES, TASK_RISKS, TASK_STATUSES } from "@/entities/task";
import { humanize } from "@/shared/lib/format";
import { hasActiveTaskFilters, type TaskFilters, useUiStore } from "@/shared/store/ui-store";
import { SelectInput, TextInput } from "@/shared/ui/control";

/** The filter keys `…/tasks` accepts, mirrored into the query string. */
const URL_KEYS = ["status", "milestone", "domain", "q"] as const;

function Choice({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string | null;
  options: readonly string[];
  onChange: (value: string | null) => void;
}) {
  return (
    <SelectInput
      aria-label={label}
      active={value !== null}
      value={value ?? ""}
      onChange={(event) => onChange(event.target.value === "" ? null : event.target.value)}
    >
      <option value="">{label}</option>
      {options.map((option) => (
        <option key={option} value={option}>
          {humanize(option)}
        </option>
      ))}
    </SelectInput>
  );
}

function TriChoice({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean | null;
  onChange: (value: boolean | null) => void;
}) {
  return (
    <SelectInput
      aria-label={label}
      active={value !== null}
      value={value === null ? "" : value ? "yes" : "no"}
      onChange={(event) =>
        onChange(event.target.value === "" ? null : event.target.value === "yes")
      }
    >
      <option value="">{label}</option>
      <option value="yes">{label}: yes</option>
      <option value="no">{label}: no</option>
    </SelectInput>
  );
}

export function TaskFilterBar({
  milestones,
  domains,
}: {
  milestones: readonly string[];
  domains: readonly string[];
}) {
  const filters = useUiStore((state) => state.taskFilters);
  const setTaskFilters = useUiStore((state) => state.setTaskFilters);
  const resetTaskFilters = useUiStore((state) => state.resetTaskFilters);
  const [params, setParams] = useSearchParams();

  // URL -> store. Runs on every navigation, which is what makes the rail's
  // `/tasks?status=failed` children work: they are plain links, not callbacks.
  const search = params.toString();
  useEffect(() => {
    const next = new URLSearchParams(search);
    const status = next.get("status");
    setTaskFilters({
      status: status === null ? [] : [status],
      milestone: next.get("milestone"),
      domain: next.get("domain"),
      search: next.get("q") ?? "",
    });
  }, [search, setTaskFilters]);

  /** Store -> URL, for the filters the server understands. */
  const patch = (change: Partial<TaskFilters>) => {
    setTaskFilters(change);
    const next = new URLSearchParams(search);
    const values: Record<(typeof URL_KEYS)[number], string | null | undefined> = {
      status: change.status === undefined ? undefined : (change.status[0] ?? null),
      milestone: change.milestone,
      domain: change.domain,
      q: change.search === undefined ? undefined : change.search.trim() || null,
    };
    for (const key of URL_KEYS) {
      const value = values[key];
      if (value === undefined) continue;
      if (value === null) next.delete(key);
      else next.set(key, value);
    }
    setParams(next, { replace: true });
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <TextInput
        type="search"
        aria-label="Search tasks"
        placeholder="Search id or title…"
        className="w-52"
        active={filters.search.trim() !== ""}
        value={filters.search}
        onChange={(event) => patch({ search: event.target.value })}
      />
      <Choice
        label="Status"
        value={filters.status[0] ?? null}
        options={TASK_STATUSES}
        onChange={(value) => patch({ status: value === null ? [] : [value] })}
      />
      <Choice
        label="Milestone"
        value={filters.milestone}
        options={milestones}
        onChange={(value) => patch({ milestone: value })}
      />
      <Choice
        label="Domain"
        value={filters.domain}
        options={domains}
        onChange={(value) => patch({ domain: value })}
      />
      <Choice
        label="Risk"
        value={filters.risk}
        options={TASK_RISKS}
        onChange={(value) => setTaskFilters({ risk: value })}
      />
      <Choice
        label="Size"
        value={filters.complexity}
        options={TASK_COMPLEXITIES}
        onChange={(value) => setTaskFilters({ complexity: value })}
      />
      <TriChoice
        label="Visual"
        value={filters.visual}
        onChange={(value) => setTaskFilters({ visual: value })}
      />
      {hasActiveTaskFilters(filters) ? (
        <button
          type="button"
          onClick={() => {
            resetTaskFilters();
            setParams(new URLSearchParams(), { replace: true });
          }}
          className="flex h-8 items-center gap-1 rounded-lg px-2 text-[13px] text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
        >
          <XIcon className="size-3.5" aria-hidden="true" />
          Clear
        </button>
      ) : null}
    </div>
  );
}
