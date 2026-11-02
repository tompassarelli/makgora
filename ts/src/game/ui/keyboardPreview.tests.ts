import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { FRIZ_QUADRATA_WIDTHS, textWidth } from "wisp/src/ui/chatLog";
import { SIM_ACTIONS, Action } from "../input/actions";
import { presetBindings, rebind } from "../input/keyBindings";
import { PREVIEW_COLUMNS, PREVIEW_INNER, PREVIEW_ROWS, PREVIEW_ROW_HEIGHT, PREVIEW_TEXT_MAX, type PreviewRow, previewKeyText, previewRowHeld, previewTextFit } from "./keyboardPreview";

const rowFor = (label: string): PreviewRow => PREVIEW_ROWS.find(placed => placed.row.label === label)?.row ?? { label, actions: [] };

test("the CONTROLS preview follows Tom's layout, covers every bindable action once, shows each row's current keys in brackets with both shield triggers and [-] when unbound, follows a rebind, lights a row only while one of its keys is held, and scales its text so every label and key fits its column inside the panel [k2 property]", () => {
  const groups = PREVIEW_COLUMNS.map(column => column.map(group => group.map(row => row.label).join(" ")).join(" | ")).join(" || ");
  assertEquals(groups, "Up: Down: Left: Right: | Mod-X (Walk): | A (Atk): B (Spc): X (Jmp): Y (Jmp): || C-Up: C-Down: C-Left: C-Right: | Mod-Y (Tilt): | Shield: Lightshield: Strong (Smash): Grab:");
  assertEquals(PREVIEW_ROWS.flatMap(placed => placed.row.actions).slice().sort((a, b) => a - b).join(","), SIM_ACTIONS.join(","), "every action the sim knows once, the toggle named in the title");
  const bindings = presetBindings("wasd");
  assertEquals(["Up:", "Down:", "Left:", "Right:"].map(label => previewKeyText(bindings, rowFor(label))).join(" "), "[W] [S] [A] [D]");
  rebind(bindings, Action.leftTrigger, 0, "Q".charCodeAt(0));
  rebind(bindings, Action.rightTrigger, 0, "7".charCodeAt(0));
  assertEquals(previewKeyText(bindings, rowFor("Shield:")), "[Q]/[7]");
  rebind(bindings, Action.attack, 0, "B".charCodeAt(0));
  assertEquals(previewKeyText(bindings, rowFor("A (Atk):")), "[B]");
  rebind(bindings, Action.attack, 0, undefined);
  rebind(bindings, Action.attack, 1, undefined);
  assertEquals(previewKeyText(bindings, rowFor("A (Atk):")), "[-]");
  const held = new Set<number>(["7".charCodeAt(0)]);
  const down = (key: number): boolean => held.has(key);
  assertTrue(previewRowHeld(bindings, rowFor("Shield:"), down));
  assertEquals(PREVIEW_ROWS.filter(placed => previewRowHeld(bindings, placed.row, down)).length, 1, "only the held key's row lights");
  for (const placed of PREVIEW_ROWS) assertTrue(placed.y + PREVIEW_ROW_HEIGHT <= PREVIEW_INNER.height + f32(0.0001));
  const fit = previewTextFit(bindings);
  assertTrue(fit.size <= PREVIEW_TEXT_MAX && fit.size > 0.0);
  const last = fit.columns[fit.columns.length - 1];
  assertTrue(last !== undefined && last.x + last.width <= PREVIEW_INNER.width + f32(0.0001));
  for (const placed of PREVIEW_ROWS) {
    const column = fit.columns[placed.column];
    assertTrue(column !== undefined && textWidth(placed.row.label, FRIZ_QUADRATA_WIDTHS) * fit.size <= column.tab);
    if (column !== undefined) assertTrue(column.tab + textWidth(previewKeyText(bindings, placed.row), FRIZ_QUADRATA_WIDTHS) * fit.size <= column.width + f32(0.0001));
  }
});
