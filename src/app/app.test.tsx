import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";
import { AppProviders } from "@/app/providers";
import { createTestRouter } from "@/app/router";

function renderApp(path = "/") {
  return render(
    <AppProviders>
      <RouterProvider router={createTestRouter(path)} />
    </AppProviders>,
  );
}

describe("app shell", () => {
  it("renders the dashboard at the index route", async () => {
    renderApp("/");
    expect(await screen.findByRole("heading", { level: 1, name: "Dashboard" })).toBeInTheDocument();
  });

  it("exposes the six top-level destinations in the main nav", async () => {
    renderApp("/");
    const nav = await screen.findByRole("navigation", { name: "Main" });
    const labels = ["Dashboard", "Tasks", "Runs", "Planner", "Stats", "Settings"];
    for (const label of labels) {
      expect(screen.getAllByRole("link", { name: label }).length).toBeGreaterThan(0);
    }
    expect(nav).toBeInTheDocument();
  });

  it("navigates to a placeholder page", async () => {
    renderApp("/");
    const nav = await screen.findByRole("navigation", { name: "Main" });
    const link = within(nav).getByRole("link", { name: "Stats" });
    await userEvent.click(link);
    expect(await screen.findByRole("heading", { level: 1, name: "Stats" })).toBeInTheDocument();
  });

  it("renders the not-found page for an unknown route", async () => {
    renderApp("/nope");
    expect(await screen.findByRole("heading", { level: 1, name: "Not found" })).toBeInTheDocument();
  });
});
