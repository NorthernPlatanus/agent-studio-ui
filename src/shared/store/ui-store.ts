/**
 * UI-only client state. **No server data lives here** — every server shape goes
 * through TanStack Query. This store holds selection, filters, layout and the
 * live-stream connection status.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type StreamStatus = "idle" | "connecting" | "open" | "error" | "closed";

export type Density = "comfortable" | "compact";

export interface TaskFilters {
  status: string[];
  milestone: string | null;
  domain: string | null;
  search: string;
}

export interface LayoutState {
  density: Density;
  sidebarCollapsed: boolean;
  /** Panel id -> open. Widgets own their own ids. */
  openPanels: Record<string, boolean>;
}

export const emptyTaskFilters: TaskFilters = {
  status: [],
  milestone: null,
  domain: null,
  search: "",
};

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
  togglePanel: (id: string) => void;
  setStreamStatus: (status: StreamStatus) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      selectedProject: null,
      taskFilters: emptyTaskFilters,
      layout: { density: "comfortable", sidebarCollapsed: false, openPanels: {} },
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
      version: 1,
      // Transient state (stream status) is deliberately not persisted.
      partialize: (state) => ({
        selectedProject: state.selectedProject,
        taskFilters: state.taskFilters,
        layout: state.layout,
      }),
    },
  ),
);
