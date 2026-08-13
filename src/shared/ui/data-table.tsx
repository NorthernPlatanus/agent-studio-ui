/**
 * The dense data table (Tier 3 — no card wrapper, `DEVDOCS/DESIGN.md` §3.4).
 *
 * **Columns are declared, never content-derived.** With `table-auto` the browser
 * measures the widest cell in every column, so the same table re-laid-out with
 * different data — the usage table switching between role / model / provider /
 * day — visibly jumps: every column moves because `deepseek/deepseek-chat` is
 * wider than `worker`. Declaring the widths up front means switching a tab
 * changes the numbers and nothing else.
 *
 * So: `table-fixed` plus a `<colgroup>`, every column sized to the content it
 * actually holds (an id is ~7 characters, a cost is `$0.0000`, a token figure is
 * `1.24M`), with exactly one flexible column per table taking the slack. Cells
 * truncate rather than wrap, because a fixed column that grows a row to two
 * lines has only moved the jump from horizontal to vertical.
 *
 * Dropping a column on a narrow container is done by **filtering the array**,
 * not by `display: none`. Hiding a `<col>` in CSS does not hide the cells and
 * does not release the track: the freed width lands on whichever column the
 * browser feels like, which was observed giving `Milestone` 202px of a 6.5rem
 * declaration. So the width is measured and the columns are chosen in JS.
 */

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useElementWidth } from "@/shared/hooks";
import { cn } from "@/shared/lib/utils";

/**
 * Which columns survived the width filter. Rows must render exactly the cells
 * the header did, and threading that through every page as a prop would put
 * table mechanics in seven screens — so `Cell` reads it and renders nothing when
 * its column was dropped.
 */
const VisibleColumns = createContext<ReadonlySet<string> | null>(null);

export interface Column {
  key: string;
  header: ReactNode;
  /** CSS width for the `<col>`. Omit on the one column that takes the slack. */
  width?: string;
  align?: "left" | "right";
  /**
   * Drop this column when the table's own container is narrower than the named
   * size. Measured against the container, not the viewport, because how much
   * room a table has depends on whether the two rails are open.
   */
  hideBelow?: keyof typeof BREAKPOINT;
}

/** Container widths in CSS pixels, matching the `@lg`/`@2xl`/`@4xl` scale. */
const BREAKPOINT = { sm: 512, md: 672, lg: 896, xl: 1152 } as const;

const TH =
  "h-8 px-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground truncate";

export function DataTable({
  columns,
  minWidth = "48rem",
  children,
  className,
}: {
  columns: readonly Column[];
  /**
   * Floor for the table's width while columns are still being dropped. Once the
   * narrowest column set is reached it is abandoned — see below.
   */
  minWidth?: string;
  children: ReactNode;
  className?: string;
}) {
  const wrapper = useRef<HTMLDivElement>(null);
  const width = useElementWidth(wrapper);

  // Width 0 is "not measured yet" — render everything rather than flashing the
  // narrow layout for a frame.
  const visible = useMemo(
    () =>
      columns.filter(
        (column) => width === 0 || !column.hideBelow || width >= BREAKPOINT[column.hideBelow],
      ),
    [columns, width],
  );
  const keys = useMemo(() => new Set(visible.map((column) => column.key)), [visible]);

  // Once every droppable column is gone, `minWidth` stops being a floor and
  // becomes a guaranteed overflow: the tasks table at 768px had dropped down to
  // Status/Task/Cost and was still forced to 34rem inside a 504px container, so
  // `Cost` rendered as a clipped "C" against the right edge. The remaining
  // columns are the ones that must fit, so below that point the table is allowed
  // to be as narrow as its container.
  const narrowest = visible.every((column) => !column.hideBelow);

  // Whether anything is actually off the right edge *right now*. Measured rather
  // than inferred, and re-measured on scroll, so the fade disappears once the
  // last column is reached instead of permanently dimming it.
  const [more, setMore] = useState(false);
  const measure = useCallback((element: HTMLDivElement | null) => {
    if (element === null) return;
    setMore(element.scrollWidth - element.clientWidth - element.scrollLeft > 1);
  }, []);
  // `width` and `columnCount` are triggers, not inputs: the overflow has to be
  // re-measured whenever the container resizes or the column set changes, and
  // neither value is readable from the DOM node the measurement uses.
  const columnCount = visible.length;
  useEffect(() => {
    void width;
    void columnCount;
    measure(wrapper.current);
  }, [measure, width, columnCount]);

  return (
    <div
      ref={wrapper}
      onScroll={(event) => measure(event.currentTarget)}
      // A soft right edge while content is still off-screen. Without it the
      // cut-off column reads as clipped rather than scrollable — macOS overlay
      // scrollbars are invisible at rest, so there is otherwise no cue at all.
      className={cn(
        "overflow-x-auto",
        more && "[mask-image:linear-gradient(to_right,black_calc(100%-2.5rem),transparent)]",
        className,
      )}
    >
      <table
        className="w-full table-fixed border-collapse text-[13px]"
        style={narrowest ? undefined : { minWidth }}
      >
        <colgroup>
          {visible.map((column) => (
            <col key={column.key} {...(column.width ? { style: { width: column.width } } : {})} />
          ))}
        </colgroup>
        <thead>
          <tr className="border-b border-border">
            {visible.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn(TH, "text-left", column.align === "right" && "text-right")}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <VisibleColumns value={keys}>
          <tbody>{children}</tbody>
        </VisibleColumns>
      </table>
    </div>
  );
}

/**
 * Whether a column survived the width filter, for rows that want to *relocate*
 * a dropped column's content rather than lose it — showing task attributes under
 * the title once their own column is gone, say. Only valid inside `<DataTable>`.
 */
export function useColumnVisible(key: string): boolean {
  const visible = useContext(VisibleColumns);
  return visible === null || visible.has(key);
}

/** A body row. `interactive` adds the hover affordance for rows that link out. */
export function Row({
  children,
  interactive = false,
  className,
}: {
  children: ReactNode;
  interactive?: boolean;
  className?: string;
}) {
  return (
    <tr
      className={cn(
        "border-b border-border/50 last:border-b-0",
        interactive && "transition-colors hover:bg-foreground/[0.03]",
        className,
      )}
    >
      {children}
    </tr>
  );
}

/**
 * A body cell. `numeric` is not just alignment: figures in this app are read
 * down a column against each other, so they are right-aligned and tabular.
 */
export function Cell({
  children,
  column,
  numeric = false,
  truncate = true,
  className,
}: {
  children: ReactNode;
  column: Column;
  numeric?: boolean;
  truncate?: boolean;
  className?: string;
}) {
  const visible = useContext(VisibleColumns);
  if (visible !== null && !visible.has(column.key)) return null;

  return (
    <td
      className={cn(
        "h-9 px-3 align-middle",
        truncate && "truncate",
        numeric ? "text-right tabular-nums" : column.align === "right" && "text-right",
        className,
      )}
    >
      {children}
    </td>
  );
}
