import { Action } from "../input/actions";
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

/** A pad player's preview: the pad's buttons for each action, until a drawn pad diagram takes the slot. */
export function padHintRows(toggleKey: string | undefined): HintRow[] {
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
    ...(toggleKey === undefined ? [] : [{ keys: toggleKey, label: "hide" }]),
  ];
}

export function hintText(rows: readonly HintRow[], accent: string): string {
  return rows.map(row => `${accent}${row.keys}|r ${row.label}`).join("\n");
}
