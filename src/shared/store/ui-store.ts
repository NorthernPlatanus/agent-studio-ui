/**
 * UI-only client state. **No server data lives here** — every server shape goes
 * through TanStack Query. This store holds selection, filters, layout and the
 * live-stream connection status.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type StreamStatus = "idle" | "connecting" | "open" | "error" | "closed";

export type Density = "comfortable" | "compact";

/**
 * The task table's filter state.
 *
 * Only `status` (single value), `milestone`, `domain` and `search` map to server
 * query params; `risk`, `complexity`, `visual` and `agentAble` — and any second
 * selected status — are narrowed client-side, because `…/tasks` does not accept
 * them (see `DECISIONS.md`). `entities/task/model/task-filters.ts` owns that split.
 */
export interface TaskFilters {
  status: string[];
  milestone: string | null;
  domain: string | null;
  risk: string | null;
  complexity: string | null;
  visual: boolean | null;
  agentAble: boolean | null;
  search: string;
}

export interface LayoutState {
  density: Density;
  sidebarCollapsed: boolean;
  /** The activity rail (`DESIGN.md` §3.1). */
  contextRailOpen: boolean;
  /**
   * Whether the operator has ever used the rail toggle. Until they have, each
   * route applies its own default; afterwards their choice follows them, because
   * a panel that keeps reopening itself is a panel you cannot close.
   */
  contextRailTouched: boolean;
  /** Panel id -> open. Widgets own their own ids. */
  openPanels: Record<string, boolean>;
}

export const emptyTaskFilters: TaskFilters = {
  status: [],
  milestone: null,
  domain: null,
  risk: null,
  complexity: null,
  visual: null,
  agentAble: null,
  search: "",
};

export const emptyLayout: LayoutState = {
  density: "comfortable",
  sidebarCollapsed: false,
  contextRailOpen: true,
  contextRailTouched: false,
  openPanels: {},
};

/** True when nothing is filtered — drives the "clear filters" affordance. */
export function hasActiveTaskFilters(filters: TaskFilters): boolean {
  return (
    filters.status.length > 0 ||
    filters.milestone !== null ||
    filters.domain !== null ||
    filters.risk !== null ||
    filters.complexity !== null ||
    filters.visual !== null ||
    filters.agentAble !== null ||
    filters.search.trim() !== ""
  );
}

export interface UiState {
  selectedProject: string | null;
  taskFilters: TaskFilters;
  layout: LayoutState;
  streamStatus: StreamStatus;

  setSelectedProject: (project: string | null) => void;
  setTaskFilters: (patch: Partial<TaskFilters>) => void;
  resetTaskFilters: () => void;
  setDensity: (density: Density) => void;
  toggleSidebar: () => void;
  setContextRail: (open: boolean, options?: { user?: boolean }) => void;
  togglePanel: (id: string) => void;
  setStreamStatus: (status: StreamStatus) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      selectedProject: null,
      taskFilters: emptyTaskFilters,
      layout: emptyLayout,
      streamStatus: "idle",

      setSelectedProject: (project) => set({ selectedProject: project }),
      setTaskFilters: (patch) =>
        set((state) => ({ taskFilters: { ...state.taskFilters, ...patch } })),
      resetTaskFilters: () => set({ taskFilters: emptyTaskFilters }),
      setDensity: (density) => set((state) => ({ layout: { ...state.layout, density } })),
      toggleSidebar: () =>
        set((state) => ({
          layout: { ...state.layout, sidebarCollapsed: !state.layout.sidebarCollapsed },
        })),
      setContextRail: (open, options) =>
        set((state) => ({
          layout: {
            ...state.layout,
            contextRailOpen: open,
            contextRailTouched: state.layout.contextRailTouched || options?.user === true,
          },
        })),
      togglePanel: (id) =>
        set((state) => ({
          layout: {
            ...state.layout,
            openPanels: { ...state.layout.openPanels, [id]: !state.layout.openPanels[id] },
          },
        })),
      setStreamStatus: (status) => set({ streamStatus: status }),
    }),
    {
      name: "agent-studio-ui",
      // v2 widened `TaskFilters`, v3 widened `LayoutState`. A persisted blob from
      // an older version is missing the new keys, so it is merged onto the current
      // defaults rather than trusted wholesale — an absent `contextRailOpen` must
      // not read as `false` and leave the rail permanently shut.
      version: 3,
      migrate: (persisted, version) => {
        const state = (persisted ?? {}) as Partial<UiState>;
        return {
          ...state,
          ...(version < 2
            ? { taskFilters: { ...emptyTaskFilters, ...(state.taskFilters ?? {}) } }
            : {}),
          layout: { ...emptyLayout, ...(state.layout ?? {}) },
        } as UiState;
      },
      // Transient state (stream status) is deliberately not persisted.
      partialize: (state) => ({
        selectedProject: state.selectedProject,
        taskFilters: state.taskFilters,
        layout: state.layout,
      }),
    },
  ),
);
