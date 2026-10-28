import { ACTION_COUNT, ACTION_ORDER, Action } from "./actions";
import { floorDiv } from "wisp/src/sim/intMath";
import { padLayerAction, padLayerKey } from "./padKeys";

export type KeySlot = 0 | 1;


export const KEY_SLOT_COUNT = ACTION_COUNT * 2;

// Saved binding slots use 0 for empty because Lua arrays cannot hold undefined.





export interface KeyBindings {
  keys: number[];
}


export type BindingPreset = "wasd" | "standard" | "custom";

export const DEFAULT_PRESET: BindingPreset = "wasd";

export const BINDING_PRESETS: readonly BindingPreset[] = ["wasd", "standard", "custom"];

export const PRESET_NAMES: Readonly<Record<BindingPreset, string>> = { wasd: "WASD", standard: "Hitbox (Space = up)", custom: "Custom" };

export const PRESET_HINTS: Readonly<Record<BindingPreset, string>> = {
  wasd: "Recommended if you're new",
  standard: "Leverless controller style",
  custom: "Hitbox with 9 jump, 8 shield and - C-up",
};

const EMPTY = 0;
const SPACE = 32;
const MINUS = 189;
const EQUALS = 187;
const SEMICOLON = 186;
const COMMA = 188;
const PERIOD = 190;
const SLASH = 191;
const OPEN_BRACKET = 219;
const CLOSE_BRACKET = 221;
const MOD_X_KEY = SEMICOLON;

const code = (character: string) => character.charCodeAt(0);

const START_KEY = code("Y");



const RESERVED_KEYS: readonly number[] = [8, 13, 27, 112, 116, 117, 118];

const RESERVED_REASONS: Readonly<Record<number, string>> = {
  8: "Backspace is reserved for Pause",
  13: "Enter is reserved for Warcraft chat",
  27: "Escape is reserved for cancel",
  89: "Y is Start on the select screens, and Strong only by default in a match",
  112: "F1 is reserved for this screen",
  116: "F5 is reserved for Warcraft shortcuts",
  117: "F6 is reserved for Warcraft shortcuts",
  118: "F7 is reserved for Warcraft shortcuts",
};

export const CLEAR_KEY = 0x2e;

export function reservedReason(key: number): string | undefined {
  return RESERVED_REASONS[key];
}

export function slotIndex(action: Action, slot: KeySlot): number {
  return action * 2 + slot;
}

export function presetBindings(preset: BindingPreset): KeyBindings {
  const custom = preset === "custom";
  const wasd = preset === "wasd";
  const keys: number[] = [];
  const bind = (action: Action, first: number, second = EMPTY) => {
    keys[slotIndex(action, 0)] = first;
    keys[slotIndex(action, 1)] = second;
  };
  bind(Action.moveLeft, code(wasd ? "A" : "W"));
  bind(Action.moveRight, code(wasd ? "D" : "R"));
  bind(Action.moveDown, code(wasd ? "S" : "E"));
  bind(Action.moveUp, wasd ? code("W") : SPACE);
  if (wasd) bind(Action.jump, SPACE, code("8"));
  else if (custom) bind(Action.jump, code("Z"), code("9"));
  else bind(Action.jump, code("8"));
  bind(Action.attack, code("N"));
  bind(Action.special, code("U"));
  bind(Action.grab, code("O"));
  bind(Action.leftTrigger, code("Q"));
  if (custom) bind(Action.rightTrigger, code("8"), code("G"));
  else bind(Action.rightTrigger, code("7"));
  bind(Action.cLeft, code("J"));
  bind(Action.cRight, code("L"));
  bind(Action.cUp, custom ? MINUS : code("0"));
  bind(Action.cDown, code("P"));
  bind(Action.walk, code("K"));
  bind(Action.lightShield, code(wasd ? "E" : "A"));
  bind(Action.shortHop, code("I"));
  if (custom) bind(Action.strong, code("0"));
  else bind(Action.strong, code("9"), START_KEY);
  bind(Action.modX, MOD_X_KEY);
  return { keys };
}

export function previousStandardKeys(): number[] {
  const keys = presetBindings("standard").keys.slice();
  const bind = (action: Action, first: number, second: number) => {
    keys[slotIndex(action, 0)] = first;
    keys[slotIndex(action, 1)] = second;
  };
  bind(Action.jump, code("Z"), code("8"));
  bind(Action.rightTrigger, code("7"), code("G"));
  bind(Action.cLeft, code("B"), SLASH);
  bind(Action.cRight, code("M"), EMPTY);
  bind(Action.lightShield, code("A"), EMPTY);
  bind(Action.cUp, code("J"), EMPTY);
  bind(Action.cDown, code("H"), EMPTY);
  bind(Action.walk, code("P"), EMPTY);
  bind(Action.strong, code("9"), code("X"));
  bind(Action.modX, EMPTY, EMPTY);
  return keys;
}

type StockPreset = "wasd" | "standard";

function earlierDefaultKeys(preset: StockPreset, cUp: number, strong: number, secondStrong: number): number[] {
  const keys = presetBindings(preset).keys.slice();
  keys[slotIndex(Action.cUp, 0)] = cUp;
  keys[slotIndex(Action.lightShield, 0)] = code("0");
  keys[slotIndex(Action.strong, 0)] = strong;
  keys[slotIndex(Action.strong, 1)] = secondStrong;
  return keys;
}

export function previousDefaultKeys(preset: StockPreset): number[] {
  return earlierDefaultKeys(preset, code("9"), START_KEY, EMPTY);
}

const earlierDefaults = (preset: StockPreset): number[][] => [previousDefaultKeys(preset), earlierDefaultKeys(preset, MINUS, code("9"), START_KEY)];

export function replacePreviousDefaults(bindings: KeyBindings, presets: readonly StockPreset[] = ["wasd", "standard"]): void {
  const preset = presets.find((stock) => earlierDefaults(stock).some((earlier) => earlier.every((key, index) => bindings.keys[index] === key)));
  if (preset !== undefined) bindings.keys = presetBindings(preset).keys;
}

function replacePreviousPreset(bindings: KeyBindings): void {
  if (previousStandardKeys().every((key, index) => bindings.keys[index] === key)) bindings.keys = presetBindings("standard").keys;
}

export function keyFor({ keys }: Readonly<KeyBindings>, action: Action, slot: KeySlot): number | undefined {
  const key = keys[slotIndex(action, slot)];
  return key === EMPTY ? undefined : key;
}

export function actionFor({ keys }: Readonly<KeyBindings>, key: number): Action | undefined {
  const index = key === EMPTY ? -1 : keys.indexOf(key);
  return index < 0 ? undefined : ACTION_ORDER[floorDiv(index, 2)];
}

export function inputAction(bindings: Readonly<KeyBindings>, key: number): Action | undefined {
  return actionFor(bindings, key) ?? padLayerAction(key);
}

export function presetOf({ keys }: Readonly<KeyBindings>): BindingPreset | undefined {
  return BINDING_PRESETS.find((preset) => presetBindings(preset).keys.every((key, index) => keys[index] === key));
}

const ARROWS: readonly (readonly [number, Action])[] = [[0x25, Action.moveLeft], [0x26, Action.moveUp], [0x27, Action.moveRight], [0x28, Action.moveDown]];
const MENU_ACTIONS: readonly Action[] = [Action.moveLeft, Action.moveRight, Action.moveUp, Action.moveDown, Action.attack, Action.special];

export function menuAction(bindings: Readonly<KeyBindings>, key: number): Action | undefined {
  const arrow = ARROWS.find(([arrowKey]) => arrowKey === key);
  if (arrow !== undefined) return arrow[1];
  const action = inputAction(bindings, key);
  return action !== undefined && MENU_ACTIONS.includes(action) ? action : undefined;
}

const PAUSE_MENU_ACTIONS: readonly Action[] = [Action.moveUp, Action.moveDown, Action.attack, Action.special];

export function pauseMenuKeys(bindings: Readonly<KeyBindings>): number[] {
  const keys = [0x26, 0x28];
  for (const action of PAUSE_MENU_ACTIONS) {
    for (const slot of [0, 1] as const) {
      const key = keyFor(bindings, action, slot);
      if (key !== undefined) keys.push(key);
    }
    const pad = padLayerKey(action).code;
    if (actionFor(bindings, pad) === undefined) keys.push(pad);
  }
  return keys;
}


function bindSlot(keys: number[], index: number, key: number): boolean {
  if (key !== EMPTY) {
    if (key < 1 || key > 255 || RESERVED_KEYS.includes(key)) return false;
    if (keys.some((bound, other) => other !== index && bound === key)) return false;
  }
  keys[index] = key;
  return true;
}


export function rebind(bindings: KeyBindings, action: Action, slot: KeySlot, key: number | undefined): boolean {
  if (key === EMPTY) return false;
  return bindSlot(bindings.keys, slotIndex(action, slot), key ?? EMPTY);
}

export type AssignResult = { kind: "bound" } | { kind: "swapped"; with: Action } | { kind: "reserved"; reason: string } | { kind: "invalid" };

export function assignKey(bindings: KeyBindings, action: Action, slot: KeySlot, key: number): AssignResult {
  const reason = reservedReason(key);
  if (reason !== undefined) return { kind: "reserved", reason };
  if (key < 1 || key > 255) return { kind: "invalid" };
  const { keys } = bindings;
  const index = slotIndex(action, slot);
  const other = keys.indexOf(key);
  if (other < 0 || other === index) {
    keys[index] = key;
    return { kind: "bound" };
  }
  keys[other] = keys[index] ?? EMPTY;
  keys[index] = key;
  const held = ACTION_ORDER[floorDiv(other, 2)];
  return held === undefined || held === action ? { kind: "bound" } : { kind: "swapped", with: held };
}

export function clearSlot(bindings: KeyBindings, action: Action, slot: KeySlot): void {
  bindings.keys[slotIndex(action, slot)] = EMPTY;
}

export function unboundActions(bindings: Readonly<KeyBindings>): Action[] {
  return ACTION_ORDER.filter((action) => keyFor(bindings, action, 0) === undefined && keyFor(bindings, action, 1) === undefined);
}





const CURRENT_SAVE = "KC";
const FIRST_SAVE_WITH_START = "KB";
const SLOTS_BEFORE_MOD_X = (Action.strong + 1) * 2;
const SAVED_SLOTS: Readonly<Record<string, number>> = { K1: 28, K2: 30, K3: 30, K4: SLOTS_BEFORE_MOD_X - 2, K5: SLOTS_BEFORE_MOD_X - 2, K6: SLOTS_BEFORE_MOD_X, K7: SLOTS_BEFORE_MOD_X, K8: SLOTS_BEFORE_MOD_X, K9: SLOTS_BEFORE_MOD_X, KA: SLOTS_BEFORE_MOD_X, KB: SLOTS_BEFORE_MOD_X, [CURRENT_SAVE]: KEY_SLOT_COUNT };
const DIGITS = "0123456789";
const SAVED_KEY_DIGITS = 3;

export const SAVED_BINDING_FORMAT = { version: CURRENT_SAVE, slots: SAVED_SLOTS, keyDigits: SAVED_KEY_DIGITS, empty: EMPTY, skippedOnLoad: START_KEY, reservedKeys: RESERVED_KEYS } as const;

export function encodeBindings({ keys }: Readonly<KeyBindings>): string {
  return CURRENT_SAVE + keys.map((key) => String(key).padStart(SAVED_KEY_DIGITS, "0")).join("");
}

function readKey(saved: string, offset: number): number | undefined {
  let value = 0;
  for (let i = offset; i < offset + SAVED_KEY_DIGITS; i++) {
    const digit = DIGITS.indexOf(saved.charAt(i));
    if (digit < 0) return undefined;
    value = value * 10 + digit;
  }
  return value;
}


function upgradeToCurrentKeys(bindings: KeyBindings, version: string): void {
  if (version < FIRST_SAVE_WITH_START) {
    if (version !== "KA") upgradeToPreviousKeys(bindings, version);
    replacePreviousPreset(bindings);
  }
  bindModXDefault(bindings);
}

function bindModXDefault(bindings: KeyBindings): void {
  const unbound = keyFor(bindings, Action.modX, 0) === undefined && keyFor(bindings, Action.modX, 1) === undefined;
  if (unbound && !bindings.keys.includes(MOD_X_KEY)) rebind(bindings, Action.modX, 0, MOD_X_KEY);
}

function upgradeToPreviousKeys(bindings: KeyBindings, version: string): void {
  const { keys } = bindings;
  if (keyFor(bindings, Action.strong, 0) === code("X") && keyFor(bindings, Action.strong, 1) === undefined) {
    keys[slotIndex(Action.strong, 0)] = EMPTY;
    keys[slotIndex(Action.strong, 1)] = code("X");
  }
  upgradeDefaults(bindings, version);
  if (keyFor(bindings, Action.strong, 0) === undefined) {
    const ex = keyFor(bindings, Action.jump, 1) === code("9") ? code("0") : code("9");
    if (!keys.includes(ex)) rebind(bindings, Action.strong, 0, ex);
  }
}

function upgradeDefaults(bindings: KeyBindings, version: string): void {
  const { keys } = bindings;
  const free = (...candidates: number[]) => candidates.every((key) => !keys.includes(key));
  const first = (action: Action) => keyFor(bindings, action, 0);
  if (version === "K9") return;
  if (version === "K8") {
    if (first(Action.cDown) === code("J") && free(code("H"))) rebind(bindings, Action.cDown, 0, code("H"));
    if (first(Action.cUp) === code("0") && free(code("J"))) rebind(bindings, Action.cUp, 0, code("J"));
    return;
  }
  if (keyFor(bindings, Action.lightShield, 1) === undefined && free(code("T"))) rebind(bindings, Action.lightShield, 1, code("T"));
  if (keyFor(bindings, Action.rightTrigger, 1) === undefined && free(code("G"))) rebind(bindings, Action.rightTrigger, 1, code("G"));
  if (keyFor(bindings, Action.strong, 1) === undefined && free(code("X"))) rebind(bindings, Action.strong, 1, code("X"));
  if (first(Action.shortHop) === undefined) {
    const hop = first(Action.jump) === code("I") ? code("Z") : code("I");
    if (free(hop)) rebind(bindings, Action.shortHop, 0, hop);
  }
  if (version === "K1" && free(code("P"))) rebind(bindings, Action.walk, 0, code("P"));

  if (first(Action.grab) === code("L") && free(code("O"))) rebind(bindings, Action.grab, 0, code("O"));
  if (first(Action.walk) === SEMICOLON && free(code("P"))) rebind(bindings, Action.walk, 0, code("P"));

  if (first(Action.moveLeft) === code("S") && first(Action.moveRight) === code("F") && first(Action.moveDown) === code("D")
    && first(Action.leftTrigger) === code("A") && free(code("Q"), code("W"), code("E"), code("R"))) {
    rebind(bindings, Action.moveLeft, 0, code("W"));
    rebind(bindings, Action.moveRight, 0, code("R"));
    rebind(bindings, Action.moveDown, 0, code("E"));
    rebind(bindings, Action.leftTrigger, 0, code("Q"));
  }

  if (first(Action.jump) === code("I") && first(Action.shortHop) === code("Z")) {
    keys[slotIndex(Action.jump, 0)] = code("Z");
    keys[slotIndex(Action.shortHop, 0)] = code("I");
  }
  if ((first(Action.lightShield) === undefined || first(Action.lightShield) === code("9") || first(Action.lightShield) === code("0")) && keyFor(bindings, Action.lightShield, 1) === code("T") && free(code("A"))) {
    keys[slotIndex(Action.lightShield, 0)] = code("A");
    keys[slotIndex(Action.lightShield, 1)] = EMPTY;
  }

}


export function decodeBindings(saved: string): KeyBindings | undefined {
  const version = saved.slice(0, 2);
  const slots = SAVED_SLOTS[version];
  if (slots === undefined || saved.length !== 2 + SAVED_KEY_DIGITS * slots) return undefined;
  const keys: number[] = [];
  for (let index = 0; index < KEY_SLOT_COUNT; index++) keys[index] = EMPTY;
  for (let index = 0; index < slots; index++) {
    const key = readKey(saved, 2 + index * SAVED_KEY_DIGITS);
    if (key === undefined) return undefined;

    const legacyStart = key === START_KEY && version < FIRST_SAVE_WITH_START;
    if (!legacyStart && !bindSlot(keys, index, key)) return undefined;
  }
  const bindings = { keys };
  if (version !== CURRENT_SAVE) upgradeToCurrentKeys(bindings, version);
  return bindings;
}


export type LayoutBindings = Record<BindingPreset, KeyBindings>;

export interface LayoutSave {
  readonly layouts: LayoutBindings;
  readonly active: BindingPreset;
}

const LAYOUT_SAVE = "KL";

export function presetLayouts(): LayoutBindings {
  return { wasd: presetBindings("wasd"), standard: presetBindings("standard"), custom: presetBindings("custom") };
}

export function encodeLayouts({ layouts, active }: LayoutSave): string {
  return LAYOUT_SAVE + BINDING_PRESETS.indexOf(active) + BINDING_PRESETS.map((preset) => encodeBindings(layouts[preset])).join("");
}

export function decodeLayouts(saved: string): LayoutSave | undefined {
  if (saved.slice(0, 2) !== LAYOUT_SAVE) return undefined;
  const active = BINDING_PRESETS[DIGITS.indexOf(saved.charAt(2))];
  if (active === undefined) return undefined;
  const layouts = presetLayouts();
  let start = 3;
  for (const preset of BINDING_PRESETS) {
    const slots = SAVED_SLOTS[saved.slice(start, start + 2)];
    if (slots === undefined) return undefined;
    const end = start + 2 + SAVED_KEY_DIGITS * slots;
    const bindings = decodeBindings(saved.slice(start, end));
    if (bindings === undefined) return undefined;
    if (preset !== "custom") replacePreviousDefaults(bindings, [preset]);
    layouts[preset] = bindings;
    start = end;
  }
  return start === saved.length ? { layouts, active } : undefined;
}


export const ACTION_LABELS: Readonly<Record<Action, string>> = {
  [Action.moveLeft]: "Move left",
  [Action.moveRight]: "Move right",
  [Action.moveDown]: "Move down",
  [Action.moveUp]: "Move up",
  [Action.jump]: "Jump",
  [Action.attack]: "Attack",
  [Action.special]: "Special",
  [Action.grab]: "Grab",
  [Action.leftTrigger]: "Left trigger",
  [Action.rightTrigger]: "Right trigger",
  [Action.cLeft]: "C-left",
  [Action.cRight]: "C-right",
  [Action.cUp]: "C-up",
  [Action.cDown]: "C-down",
  [Action.walk]: "Walk",
  [Action.lightShield]: "Light shield",
  [Action.shortHop]: "Short hop (LB in the tom pad layout)",
  [Action.strong]: "Strong (smash, EX special)",
  [Action.modX]: "Mod X",
};

export const ACTION_KEY_LABELS: Readonly<Record<Action, string>> = {
  [Action.moveLeft]: "Left",
  [Action.moveRight]: "Right",
  [Action.moveDown]: "Down",
  [Action.moveUp]: "Up",
  [Action.jump]: "Jump",
  [Action.attack]: "Attack",
  [Action.special]: "Special",
  [Action.grab]: "Grab",
  [Action.leftTrigger]: "Shield",
  [Action.rightTrigger]: "Shield R",
  [Action.cLeft]: "C-left",
  [Action.cRight]: "C-right",
  [Action.cUp]: "C-up",
  [Action.cDown]: "C-down",
  [Action.walk]: "Walk",
  [Action.lightShield]: "Light sh.",
  [Action.shortHop]: "Hop",
  [Action.strong]: "Strong",
  [Action.modX]: "Mod X",
};

export function keyLabel(key: number | undefined): string {
  if (key === undefined) return "—";
  if (key === SPACE) return "SPACE";
  if (key === SLASH) return "/";
  if (key === MINUS) return "-";
  if (key === EQUALS) return "=";
  if (key === SEMICOLON) return ";";
  if (key === COMMA) return ",";
  if (key === PERIOD) return ".";
  if (key === OPEN_BRACKET) return "[";
  if (key === CLOSE_BRACKET) return "]";
  if ((key >= code("A") && key <= code("Z")) || (key >= code("0") && key <= code("9"))) return String.fromCharCode(key);
  return `KEY ${key}`;
}

export function keyNames(bindings: Readonly<KeyBindings>, action: Action): string {
  const first = keyFor(bindings, action, 0);
  const second = keyFor(bindings, action, 1);
  if (first === undefined || second === undefined) return keyLabel(first ?? second);
  return `${keyLabel(first)}/${keyLabel(second)}`;
}
