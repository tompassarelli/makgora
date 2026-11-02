import { f32 } from "wisp/src/sim/f32";
import { FRIZ_QUADRATA_WIDTHS, textWidth } from "wisp/src/ui/chatLog";
import { Action } from "../input/actions";
import { type KeyBindings, keyFor, keyLabel } from "../input/keyBindings";

/** One row of the CONTROLS panel: its label and the actions whose keys it shows. */
export interface PreviewRow {
  readonly label: string;
  readonly actions: readonly Action[];
}

/** A column of the panel: groups of rows with a divider between each pair. */
export type PreviewColumn = readonly (readonly PreviewRow[])[];

const row = (label: string, ...actions: Action[]): PreviewRow => ({ label: `${label}:`, actions });

/** Tom's CONTROLS panel (2026-11-02): every action the keyboard can bind, in his rows, labels, groups and order. */
export const PREVIEW_COLUMNS: readonly PreviewColumn[] = [
  [
    [row("Up", Action.moveUp), row("Down", Action.moveDown), row("Left", Action.moveLeft), row("Right", Action.moveRight)],
    [row("Mod-X (Walk)", Action.modX)],
    [row("A (Atk)", Action.attack), row("B (Spc)", Action.special), row("X (Jmp)", Action.jump), row("Y (Jmp)", Action.shortHop)],
  ],
  [
    [row("C-Up", Action.cUp), row("C-Down", Action.cDown), row("C-Left", Action.cLeft), row("C-Right", Action.cRight)],
    [row("Mod-Y (Tilt)", Action.modY)],
    [row("Shield", Action.leftTrigger, Action.rightTrigger), row("Lightshield", Action.lightShield), row("Strong (Smash)", Action.strong), row("Grab", Action.grab)],
  ],
];

const columnRows = (column: PreviewColumn): readonly PreviewRow[] => column.flatMap(group => group);

/** Tom asked on 2026-11-02 for the panel title to name its toggle key, a rebindable action; with the action unbound the title is plain Controls. */
export const previewTitle = (toggleKey: string | undefined): string => toggleKey === undefined ? "Controls" : `Controls - ${toggleKey} to toggle`;
export const PREVIEW_PANEL = { width: f32(0.29), height: f32(0.138), margin: f32(0.004) } as const;
export const PREVIEW_INNER = { width: f32(PREVIEW_PANEL.width - 2 * PREVIEW_PANEL.margin), height: f32(PREVIEW_PANEL.height - 2 * PREVIEW_PANEL.margin) } as const;
const COLUMN_GAP_EMS = f32(1.2);
const TAB_GAP_EMS = f32(0.5);
const DIVIDER_ROWS = 0.5;
const ROWS_TALL = Math.max(...PREVIEW_COLUMNS.map(column => columnRows(column).length + DIVIDER_ROWS * (column.length - 1))) + 1;
export const PREVIEW_ROW_HEIGHT = f32(PREVIEW_INNER.height / ROWS_TALL);
export const PREVIEW_TEXT_MAX = f32(PREVIEW_ROW_HEIGHT * f32(0.9));

/** A row's place: its column and its top below the panel's inner top edge, under the title row, each divider adding half a row. */
export interface PlacedRow {
  readonly row: PreviewRow;
  readonly column: number;
  readonly y: number;
}

export const PREVIEW_ROWS: readonly PlacedRow[] = PREVIEW_COLUMNS.flatMap((column, index) => {
  const placed: PlacedRow[] = [];
  let y = 1.0;
  column.forEach((group, at) => {
    if (at > 0) y += DIVIDER_ROWS;
    for (const row of group) {
      placed.push({ row, column: index, y: f32(PREVIEW_ROW_HEIGHT * y) });
      y += 1.0;
    }
  });
  return placed;
});

/** The dividers' heights below the panel's inner top edge, each half a row under the group above it. */
export const PREVIEW_DIVIDERS: readonly { readonly column: number; readonly y: number }[] = PREVIEW_COLUMNS.flatMap((column, index) => {
  const dividers: { column: number; y: number }[] = [];
  let y = 1.0;
  column.forEach((group, at) => {
    if (at > 0) {
      dividers.push({ column: index, y: f32(PREVIEW_ROW_HEIGHT * (y + DIVIDER_ROWS / 2)) });
      y += DIVIDER_ROWS;
    }
    y += group.length;
  });
  return dividers;
});

const firstKey = (bindings: Readonly<KeyBindings>, action: Action): number | undefined => keyFor(bindings, action, 0) ?? keyFor(bindings, action, 1);

/** The row's keys in brackets as the player's current bindings name them, both when a row's two actions are bound ([Q]/[7]), or [-] when none is. */
export function previewKeyText(bindings: Readonly<KeyBindings>, row: PreviewRow): string {
  const shown: string[] = [];
  for (const action of row.actions) {
    const key = firstKey(bindings, action);
    if (key !== undefined) shown.push(`[${keyLabel(key)}]`);
  }
  return shown.length === 0 ? "[-]" : shown.join("/");
}

export function previewRowHeld(bindings: Readonly<KeyBindings>, row: PreviewRow, down: (this: void, key: number) => boolean): boolean {
  for (const action of row.actions) {
    const first = keyFor(bindings, action, 0);
    const second = keyFor(bindings, action, 1);
    if ((first !== undefined && down(first)) || (second !== undefined && down(second))) return true;
  }
  return false;
}

/** A column laid out for the current keys, from the panel's inner left edge: where it starts, where its keys start and how wide it is. */
export interface FittedColumn {
  readonly x: number;
  readonly tab: number;
  readonly width: number;
}

const ems = (text: string): number => textWidth(text, FRIZ_QUADRATA_WIDTHS);

/** The text size and the columns: each column as wide as its longest label and key, at the largest size up to PREVIEW_TEXT_MAX that fits the panel. */
export function previewTextFit(bindings: Readonly<KeyBindings>): { readonly size: number; readonly columns: readonly FittedColumn[] } {
  const widths = PREVIEW_COLUMNS.map(column => {
    const rows = columnRows(column);
    const label = Math.max(...rows.map(row => ems(row.label)));
    return { label, total: label + TAB_GAP_EMS + Math.max(...rows.map(row => ems(previewKeyText(bindings, row)))) };
  });
  let total = COLUMN_GAP_EMS * (widths.length - 1);
  for (const width of widths) total += width.total;
  const size = f32(Math.min(PREVIEW_TEXT_MAX, PREVIEW_INNER.width / total));
  const spare = f32(PREVIEW_INNER.width - total * size);
  const columns: FittedColumn[] = [];
  let x = 0.0;
  widths.forEach(width => {
    const columnWidth = f32(width.total * size + spare / widths.length);
    columns.push({ x: f32(x), tab: f32((width.label + TAB_GAP_EMS) * size), width: columnWidth });
    x = f32(x + columnWidth + COLUMN_GAP_EMS * size);
  });
  return { size, columns };
}
