/**
 * The width contract of `DataTable`.
 *
 * The defect these pin: `minWidth` is a floor, and a floor survives column
 * dropping. At 768px the tasks table had already dropped to Status/Task/Cost and
 * was *still* forced to `34rem` (544px) inside a 504px container, so the last
 * column rendered as a clipped glyph against the right edge with no scrollbar
 * hinting there was more. Dropping columns to fit and then refusing to fit is
 * the worst of both.
 *
 * `ResizeObserver` is stubbed in jsdom and never fires, so the measured width is
 * driven directly here rather than through the hook.
 */

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Cell, type Column, DataTable, Row } from "./data-table";

const WIDTH = { current: 0 };

vi.mock("@/shared/hooks", () => ({
  useElementWidth: () => WIDTH.current,
}));

const STATUS: Column = { key: "status", header: "Status", width: "8.5rem" };
const TASK: Column = { key: "task", header: "Task" };
const EXTRA: Column = { key: "extra", header: "Extra", width: "20rem", hideBelow: "lg" };
const COST: Column = { key: "cost", header: "Cost", width: "6rem" };
const COLUMNS = [STATUS, TASK, EXTRA, COST];

function renderTable() {
  return render(
    <DataTable columns={COLUMNS} minWidth="34rem">
      <Row>
        <Cell column={STATUS}>ready</Cell>
        <Cell column={TASK}>a task</Cell>
        <Cell column={EXTRA}>chips</Cell>
        <Cell column={COST}>$0.01</Cell>
      </Row>
    </DataTable>,
  );
}

function table(): HTMLTableElement {
  const element = screen.getByRole("table");
  return element as HTMLTableElement;
}

describe("DataTable width behaviour", () => {
  beforeEach(() => {
    WIDTH.current = 0;
  });

  it("renders every column before the first measurement", () => {
    // One frame too wide is a scrollbar; one frame too narrow is a visible
    // collapse. Unmeasured therefore means "show everything".
    renderTable();
    expect(screen.getByRole("columnheader", { name: "Extra" })).toBeInTheDocument();
    expect(table().style.minWidth).toBe("34rem");
  });

  it("keeps the floor while there are still columns left to drop", () => {
    WIDTH.current = 700; // below `lg` (896), so Extra goes; nothing else can.
    renderTable();
    expect(screen.queryByRole("columnheader", { name: "Extra" })).not.toBeInTheDocument();
    expect(table().style.minWidth).toBe("");
  });

  it("drops the floor once the narrowest column set is reached", () => {
    // The remaining columns are the ones that must fit. Forcing 34rem into a
    // 504px container here is what produced the clipped "Cost" header.
    WIDTH.current = 504;
    renderTable();
    expect(screen.getByRole("columnheader", { name: "Cost" })).toBeInTheDocument();
    expect(table().style.minWidth).toBe("");
  });

  it("renders the same cells the header did", () => {
    WIDTH.current = 504;
    renderTable();
    const headers = screen.getAllByRole("columnheader").map((cell) => cell.textContent);
    const cells = screen.getAllByRole("cell").map((cell) => cell.textContent);
    expect(headers).toEqual(["Status", "Task", "Cost"]);
    expect(cells).toEqual(["ready", "a task", "$0.01"]);
  });
});
