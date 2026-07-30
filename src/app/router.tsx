import { createBrowserRouter, createMemoryRouter, type RouteObject } from "react-router";
import { AppLayout } from "@/app/layout/app-layout";
import { NotFoundPage } from "@/app/not-found";
import { DashboardPage } from "@/pages/dashboard";
import { PlannerPage } from "@/pages/planner";
import { RunDetailPage } from "@/pages/run-detail";
import { RunsPage } from "@/pages/runs";
import { SettingsPage } from "@/pages/settings";
import { StatsPage } from "@/pages/stats";
import { TaskDetailPage } from "@/pages/task-detail";
import { TasksPage } from "@/pages/tasks";

export const routes: RouteObject[] = [
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "tasks", element: <TasksPage /> },
      { path: "tasks/:taskId", element: <TaskDetailPage /> },
      { path: "runs", element: <RunsPage /> },
      { path: "runs/:runId", element: <RunDetailPage /> },
      { path: "planner", element: <PlannerPage /> },
      { path: "stats", element: <StatsPage /> },
      { path: "settings", element: <SettingsPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
];

export const router = createBrowserRouter(routes);

/** Tests drive the same route table without a DOM history. */
export function createTestRouter(initialPath = "/") {
  return createMemoryRouter(routes, { initialEntries: [initialPath] });
}
