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

/**
 * These assert the *chrome*, not page headings — screens deliberately have no
 * `<h1>` (`devdocs/DESIGN.md` §3.3). Where you are is stated once, by the top
 * bar's location chip, so that is what a navigation test must read.
 */
describe("app shell", () => {
  it("names the current screen in the top bar rather than in a page heading", async () => {
    renderApp("/");
    const crumb = await screen.findByRole("navigation", { name: "Breadcrumb" });
    expect(within(crumb).getByText("Dashboard")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
  });

  it("exposes every top-level destination in the main nav", async () => {
    renderApp("/");
    const nav = await screen.findByRole("navigation", { name: "Main" });
    for (const label of ["Dashboard", "Tasks", "Launch", "Runs", "Planner", "Stats"]) {
      expect(within(nav).getAllByRole("link", { name: label }).length).toBeGreaterThan(0);
    }
    // Settings lives in the rail's preferences block, outside the <nav>.
    expect(screen.getAllByRole("link", { name: "Settings" }).length).toBeGreaterThan(0);
  });

  it("groups the nav and hangs queue counts off the pipeline children", async () => {
    renderApp("/");
    const nav = await screen.findByRole("navigation", { name: "Main" });
    for (const caption of ["Overview", "Pipeline", "Analysis"]) {
      expect(within(nav).getByRole("heading", { name: caption })).toBeInTheDocument();
    }
    // Pre-filtered views, per DESIGN §3.2 — the four statuses an operator chases.
    const ready = within(nav).getByRole("link", { name: /Ready/ });
    expect(ready).toHaveAttribute("href", "/tasks?status=ready");
  });

  it("navigates through the rail and updates the location chip", async () => {
    renderApp("/");
    const nav = await screen.findByRole("navigation", { name: "Main" });
    await userEvent.click(within(nav).getByRole("link", { name: "Stats" }));
    const crumb = await screen.findByRole("navigation", { name: "Breadcrumb" });
    expect(within(crumb).getByText("Stats")).toBeInTheDocument();
  });

  it("renders the not-found state for an unknown route", async () => {
    renderApp("/nope");
    expect(await screen.findByText(/does not exist in the panel/)).toBeInTheDocument();
  });
});
