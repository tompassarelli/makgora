import { Action } from "../input/actions";
import { type KeyBindings, keyFor, keyLabel, keyNames } from "../input/keyBindings";
import { PAD_LAYOUTS, type PadControl } from "../input/padLayouts";

export type HintDevice = "keyboard" | "pad";

export interface HintRow {
  readonly keys: string;
  readonly label: string;
}

const PAD_BUTTONS: Readonly<Partial<Record<PadControl, string>>> = { a: "A", b: "B", x: "X", y: "Y", lb: "LB", rb: "RB", lt: "LT", rt: "RT", start: "Start" };

function padButtons(action: Action): string {
  const layout = PAD_LAYOUTS[0];
  const names: string[] = [];
  for (const binding of layout?.bindings ?? []) {
    const name = PAD_BUTTONS[binding.control];
    if (binding.action === action && name !== undefined && !names.includes(name)) names.push(name);
  }
  return names.length === 0 ? "—" : names.join("/");
}

function keyboardMove(bindings: Readonly<KeyBindings>): string {
  const keys = [Action.moveUp, Action.moveLeft, Action.moveDown, Action.moveRight].map(action => keyLabel(keyFor(bindings, action, 0) ?? keyFor(bindings, action, 1)));
  return keys.join(" ");
}

export function hintRows(device: HintDevice, bindings: Readonly<KeyBindings>, hideKeyFree: boolean): HintRow[] {
  if (device === "pad") {
    return [
      { keys: "Left stick", label: "move" },
      { keys: padButtons(Action.jump), label: "jump" },
      { keys: padButtons(Action.attack), label: "attack" },
      { keys: padButtons(Action.special), label: "special" },
      { keys: padButtons(Action.leftTrigger), label: "shield" },
      { keys: padButtons(Action.grab), label: "grab" },
      { keys: padButtons(Action.strong), label: "Strong" },
      { keys: "R stick tilt", label: "Mod X + Y" },
      { keys: "Start", label: "pause" },
      ...(hideKeyFree ? [{ keys: "H", label: "hide" }] : []),
    ];
  }
  return [
    { keys: keyboardMove(bindings), label: "move" },
    { keys: keyNames(bindings, Action.jump), label: "jump" },
    { keys: keyNames(bindings, Action.attack), label: "attack" },
    { keys: keyNames(bindings, Action.special), label: "special" },
    { keys: keyNames(bindings, Action.leftTrigger), label: "shield" },
    { keys: keyNames(bindings, Action.grab), label: "grab" },
    { keys: keyNames(bindings, Action.strong), label: "Strong" },
    { keys: keyNames(bindings, Action.modX), label: "Mod X" },
    { keys: keyNames(bindings, Action.modY), label: "Mod Y" },
    { keys: "Esc", label: "pause" },
    ...(hideKeyFree ? [{ keys: "H", label: "hide" }] : []),
  ];
}

export function hintText(rows: readonly HintRow[], accent: string): string {
  return rows.map(row => `${accent}${row.keys}|r ${row.label}`).join("\n");
}
