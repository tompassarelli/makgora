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

export const PRESET_NAMES: Readonly<Record<BindingPreset, string>> = { wasd: "WASD", standard: "Box", custom: "Custom" };

export const PRESET_HINTS: Readonly<Record<BindingPreset, string>> = {
  wasd: "Recommended if you're new. W is up, 8 jumps",
  standard: "Leverless controller style",
  custom: "Box with 9 jump, 8 shield and 0 Strong",
};

const EMPTY = 0;
const SPACE = 32;
export const SHIFT = 16;
export const LEFT_SHIFT = 160;
export const RIGHT_SHIFT = 161;
const MINUS = 189;
const EQUALS = 187;
const SEMICOLON = 186;
const COMMA = 188;
const PERIOD = 190;
const SLASH = 191;
const OPEN_BRACKET = 219;
const CLOSE_BRACKET = 221;
const MOD_Y_KEY = SEMICOLON;
export const TOGGLE_CONTROLS_KEY = 113;

const code = (character: string) => character.charCodeAt(0);

const START_KEY = code("Y");



const RESERVED_KEYS: readonly number[] = [8, 13, 27, 112, 116, 117, 118];

const RESERVED_REASONS: Readonly<Record<number, string>> = {
  8: "Backspace is reserved for Pause",
  13: "Enter is reserved for Warcraft chat",
  27: "Escape is reserved for Pause and cancel",
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
  if (wasd) bind(Action.moveUp, code("W"));
  else bind(Action.moveUp, SPACE);
  bind(Action.jump, code(custom ? "9" : "8"));
  bind(Action.attack, code("N"));
  bind(Action.special, code("U"));
  bind(Action.grab, code("O"));
  bind(Action.leftTrigger, code("Q"));
  bind(Action.rightTrigger, code(custom ? "8" : "7"));
  bind(Action.cLeft, code("J"));
  bind(Action.cRight, code("L"));
  bind(Action.cUp, START_KEY);
  bind(Action.cDown, code("K"));
  bind(Action.modX, code("P"));
  bind(Action.lightShield, code(wasd ? "E" : "A"));
  bind(Action.shortHop, code("I"));
  if (custom) bind(Action.strong, code("0"));
  else bind(Action.strong, code("9"));
  bind(Action.modY, MOD_Y_KEY);
  bind(Action.toggleControls, TOGGLE_CONTROLS_KEY);
  return { keys };
}

export function previousStandardKeys(): number[] {
  const keys = presetBindings("standard").keys.slice(0, SLOTS_BEFORE_TOGGLE);
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
  bind(Action.modX, code("P"), EMPTY);
  bind(Action.strong, code("9"), code("X"));
  bind(Action.modY, EMPTY, EMPTY);
  return keys;
}

type StockPreset = "wasd" | "standard";

type KeyChange = readonly [action: Action, first: number, second?: number];

const previousCStickKeys = (preset: BindingPreset): readonly KeyChange[] => [[Action.cUp, preset === "custom" ? MINUS : code("0")], [Action.cDown, code("P")], [Action.modX, code("K")]];

const PREVIOUS_C_UP: KeyChange = [Action.cUp, code("H")];

const withKeys = (preset: BindingPreset, changes: readonly KeyChange[]): number[] => {
  const keys = presetBindings(preset).keys.slice(0, SLOTS_BEFORE_TOGGLE);
  for (const [action, first, second = EMPTY] of [PREVIOUS_C_UP, ...changes]) {
    keys[slotIndex(action, 0)] = first;
    keys[slotIndex(action, 1)] = second;
  }
  return keys;
};

const PREVIOUS_STOCK_CHANGES: readonly KeyChange[] = [[Action.strong, code("9"), START_KEY]];

const PREVIOUS_WASD_UP: KeyChange = [Action.moveUp, code("W"), SPACE];

const EARLIER_STOCK_CHANGES: readonly (readonly KeyChange[])[] = [
  [[Action.cUp, code("9")], [Action.lightShield, code("0")], [Action.strong, START_KEY]],
  [[Action.cUp, MINUS], [Action.lightShield, code("0")], [Action.strong, code("9"), START_KEY]],
];

const EARLIER_WASD_JUMP: readonly KeyChange[] = [[Action.moveUp, code("W")], [Action.jump, SPACE, code("8")]];

const EARLIER_CUSTOM_JUMP: readonly KeyChange[] = [[Action.jump, code("Z"), code("9")]];

const earlierStockKeys = (preset: StockPreset, changes: readonly KeyChange[]): number[] => withKeys(preset, preset === "wasd" ? [...changes, ...EARLIER_WASD_JUMP] : changes);

function earlierDefaults(preset: BindingPreset): number[][] {
  if (preset === "custom") return [withKeys(preset, []), withKeys(preset, previousCStickKeys(preset)), withKeys(preset, EARLIER_CUSTOM_JUMP)];
  const earlier = [withKeys(preset, []), withKeys(preset, previousCStickKeys(preset)), previousSimKeys(preset), ...EARLIER_STOCK_CHANGES.map((changes) => earlierStockKeys(preset, changes))];
  return preset === "wasd" ? [...earlier, earlierStockKeys(preset, PREVIOUS_STOCK_CHANGES)] : earlier;
}

function previousSimKeys(preset: StockPreset): number[] {
  return withKeys(preset, preset === "wasd" ? [...PREVIOUS_STOCK_CHANGES, PREVIOUS_WASD_UP] : PREVIOUS_STOCK_CHANGES);
}

/** The previous defaults as a player who never touched them holds them now: the old keys plus the default Toggle controls key. */
export function previousDefaultKeys(preset: StockPreset): number[] {
  return [...previousSimKeys(preset), TOGGLE_CONTROLS_KEY, EMPTY];
}

/** A stock layout's sim keys replace an earlier default's, keeping the player's own toggle-controls keys. */
function adoptPreset(bindings: KeyBindings, preset: BindingPreset): void {
  const keys = presetBindings(preset).keys;
  for (let index = SLOTS_BEFORE_TOGGLE; index < KEY_SLOT_COUNT; index++) keys[index] = bindings.keys[index] ?? EMPTY;
  bindings.keys = keys;
}

export function replacePreviousDefaults(bindings: KeyBindings, presets: readonly BindingPreset[] = BINDING_PRESETS): void {
  const preset = presets.find((stock) => earlierDefaults(stock).some((earlier) => earlier.every((key, index) => bindings.keys[index] === key)));
  if (preset !== undefined) adoptPreset(bindings, preset);
}

function replacePreviousPreset(bindings: KeyBindings): void {
  if (previousStandardKeys().every((key, index) => bindings.keys[index] === key)) adoptPreset(bindings, "standard");
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
const MENU_ACTIONS: readonly Action[] = [Action.moveLeft, Action.moveRight, Action.moveUp, Action.moveDown, Action.attack, Action.special, Action.jump];

export function menuAction(bindings: Readonly<KeyBindings>, key: number): Action | undefined {
  const arrow = ARROWS.find(([arrowKey]) => arrowKey === key);
  if (arrow !== undefined) return arrow[1];
  const action = inputAction(bindings, key);
  return action !== undefined && MENU_ACTIONS.includes(action) ? action : undefined;
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





const CURRENT_SAVE = "KE";
const FIRST_SAVE_WITH_START = "KB";
const FIRST_SAVE_WITH_MOD_Y_KEPT = "KC";
const FIRST_SAVE_WITH_C_UP_ON_Y = "KD";
const FIRST_SAVE_WITH_TOGGLE = "KE";
const SLOTS_BEFORE_TOGGLE = (Action.modY + 1) * 2;
const SLOTS_BEFORE_MOD_Y = (Action.strong + 1) * 2;
const SAVED_SLOTS: Readonly<Record<string, number>> = { K1: 28, K2: 30, K3: 30, K4: SLOTS_BEFORE_MOD_Y - 2, K5: SLOTS_BEFORE_MOD_Y - 2, K6: SLOTS_BEFORE_MOD_Y, K7: SLOTS_BEFORE_MOD_Y, K8: SLOTS_BEFORE_MOD_Y, K9: SLOTS_BEFORE_MOD_Y, KA: SLOTS_BEFORE_MOD_Y, KB: SLOTS_BEFORE_MOD_Y, KC: SLOTS_BEFORE_TOGGLE, KD: SLOTS_BEFORE_TOGGLE, [CURRENT_SAVE]: KEY_SLOT_COUNT };
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


const OLD_AUTO_BOUND_KEYS: readonly (readonly [Action, string])[] = [[Action.jump, "Z"], [Action.strong, "X"], [Action.rightTrigger, "G"]];

function dropOldAutoBoundKeys({ keys }: KeyBindings): void {
  for (const [action, character] of OLD_AUTO_BOUND_KEYS) {
    if (keys[slotIndex(action, 1)] === code(character)) keys[slotIndex(action, 1)] = EMPTY;
  }
}

function upgradeToCurrentKeys(bindings: KeyBindings, version: string): void {
  if (version < FIRST_SAVE_WITH_START) {
    if (version !== "KA") upgradeToPreviousKeys(bindings, version);
    replacePreviousPreset(bindings);
  }
  if (version < FIRST_SAVE_WITH_MOD_Y_KEPT) bindModYDefault(bindings);
  if (version < FIRST_SAVE_WITH_C_UP_ON_Y) moveCUpToStart(bindings);
  if (version < FIRST_SAVE_WITH_TOGGLE) bindToggleDefault(bindings);
}

function bindToggleDefault(bindings: KeyBindings): void {
  if (!bindings.keys.includes(TOGGLE_CONTROLS_KEY)) rebind(bindings, Action.toggleControls, 0, TOGGLE_CONTROLS_KEY);
}

function moveCUpToStart(bindings: KeyBindings): void {
  if (bindings.keys.includes(START_KEY)) return;
  for (const slot of [0, 1] as const) {
    if (keyFor(bindings, Action.cUp, slot) === code("H")) rebind(bindings, Action.cUp, slot, START_KEY);
  }
}

function bindModYDefault(bindings: KeyBindings): void {
  const unbound = keyFor(bindings, Action.modY, 0) === undefined && keyFor(bindings, Action.modY, 1) === undefined;
  if (unbound && !bindings.keys.includes(MOD_Y_KEY)) rebind(bindings, Action.modY, 0, MOD_Y_KEY);
}

function upgradeToPreviousKeys(bindings: KeyBindings, version: string): void {
  const { keys } = bindings;
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
  if (first(Action.shortHop) === undefined && free(code("I"))) rebind(bindings, Action.shortHop, 0, code("I"));
  if (version === "K1" && free(code("P"))) rebind(bindings, Action.modX, 0, code("P"));

  if (first(Action.grab) === code("L") && free(code("O"))) rebind(bindings, Action.grab, 0, code("O"));
  if (first(Action.modX) === SEMICOLON && free(code("P"))) rebind(bindings, Action.modX, 0, code("P"));

  if (first(Action.moveLeft) === code("S") && first(Action.moveRight) === code("F") && first(Action.moveDown) === code("D")
    && first(Action.leftTrigger) === code("A") && free(code("Q"), code("W"), code("E"), code("R"))) {
    rebind(bindings, Action.moveLeft, 0, code("W"));
    rebind(bindings, Action.moveRight, 0, code("R"));
    rebind(bindings, Action.moveDown, 0, code("E"));
    rebind(bindings, Action.leftTrigger, 0, code("Q"));
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
  dropOldAutoBoundKeys(bindings);
  return bindings;
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
  [Action.modX]: "Walk (and steep angles)",
  [Action.lightShield]: "Light shield",
  [Action.shortHop]: "Short hop (LB in the tom pad layout)",
  [Action.strong]: "Strong (smash)",
  [Action.modY]: "Mod Y (shallow angles, wall ride)",
  [Action.toggleControls]: "Toggle controls panel",
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
  [Action.modX]: "Walk",
  [Action.lightShield]: "Light sh.",
  [Action.shortHop]: "Hop",
  [Action.strong]: "Strong",
  [Action.modY]: "Mod Y",
  [Action.toggleControls]: "Controls",
};

const KEY_NAMES: Readonly<Record<number, string>> = {
  [SPACE]: "SPACE", [SHIFT]: "SHIFT", [LEFT_SHIFT]: "L-SHIFT", [RIGHT_SHIFT]: "R-SHIFT", [SLASH]: "/", [TOGGLE_CONTROLS_KEY]: "F2", [MINUS]: "-", [EQUALS]: "=", [SEMICOLON]: ";",
  [COMMA]: ",", [PERIOD]: ".", [OPEN_BRACKET]: "[", [CLOSE_BRACKET]: "]",
};

export function keyLabel(key: number | undefined): string {
  if (key === undefined) return "—";
  const named = KEY_NAMES[key];
  if (named !== undefined) return named;
  if ((key >= code("A") && key <= code("Z")) || (key >= code("0") && key <= code("9"))) return String.fromCharCode(key);
  return `KEY ${key}`;
}

export function keyNames(bindings: Readonly<KeyBindings>, action: Action): string {
  const first = keyFor(bindings, action, 0);
  const second = keyFor(bindings, action, 1);
  if (first === undefined || second === undefined) return keyLabel(first ?? second);
  return `${keyLabel(first)}/${keyLabel(second)}`;
}
