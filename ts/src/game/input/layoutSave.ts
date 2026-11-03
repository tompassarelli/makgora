import { BINDING_PRESETS, type BindingPreset, type KeyBindings, SAVED_BINDING_FORMAT, decodeBindings, encodeBindings, presetBindings, replacePreviousDefaults } from "./keyBindings";

const DIGITS = "0123456789";

export type LayoutBindings = Record<BindingPreset, KeyBindings>;

export const CUSTOM_SLOT_COUNT = 3;
export const MAX_CUSTOM_SLOTS = 9;
export const SLOT_NAME_LIMIT = 16;
const NAME_CHARACTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 -_.";

export interface CustomSlot {
  bindings: KeyBindings;
  name: string;
}

export interface LayoutSave {
  readonly layouts: LayoutBindings;
  readonly active: BindingPreset;
  readonly customs: CustomSlot[];
  readonly slot: number;
  readonly keyboard: boolean;
  readonly stickJump: boolean;
  readonly cStickTilt: boolean;
}

const LAYOUT_SAVE = "KL";
const SLOTS_SAVE = "KM";
const HINTS_SAVE = "KN";
const KEYBOARD_SAVE = "KO";

export function slotName(typed: string): string {
  let name = "";
  for (let index = 0; index < typed.length && name.length < SLOT_NAME_LIMIT; index++) {
    const character = typed.charAt(index);
    if (NAME_CHARACTERS.includes(character)) name += character;
  }
  return name.trim();
}

export const customSlotLabel = (customs: readonly CustomSlot[], slot: number): string => {
  const name = customs[slot]?.name ?? "";
  return name !== "" ? name : `Custom ${slot + 1}`;
};

export const customSlotEmpty = (customs: readonly CustomSlot[], slot: number): boolean => {
  const custom = customs[slot];
  return custom !== undefined && custom.name === "" && encodeBindings(custom.bindings) === encodeBindings(presetBindings("custom"));
};

export function presetLayouts(): LayoutBindings {
  return { wasd: presetBindings("wasd"), standard: presetBindings("standard"), custom: presetBindings("custom") };
}

/** A brand-new player sees the keyboard preview; a save from before the setting existed loads with it off. */
export function layoutSave(layouts: LayoutBindings, active: BindingPreset, keyboard = true, stickJump = false, cStickTilt = true): LayoutSave {
  const customs: CustomSlot[] = [];
  for (let slot = 0; slot < CUSTOM_SLOT_COUNT; slot++) customs.push({ bindings: slot === 0 ? layouts.custom : presetBindings("custom"), name: "" });
  return { layouts, active, customs, slot: 0, keyboard, stickJump, cStickTilt };
}

export function encodeLayouts({ layouts, active, customs, slot, keyboard, stickJump, cStickTilt }: LayoutSave): string {
  const custom = customs.map(({ bindings, name }) => encodeBindings(bindings) + String(name.length).padStart(2, "0") + name).join("");
  const flags = (keyboard ? 1 : 0) + (stickJump ? 2 : 0) + (cStickTilt ? 0 : 4);
  return KEYBOARD_SAVE + BINDING_PRESETS.indexOf(active) + slot + flags + encodeBindings(layouts.wasd) + encodeBindings(layouts.standard) + custom;
}

interface Cursor {
  readonly saved: string;
  at: number;
}

function readBindings(cursor: Cursor, preset: BindingPreset): KeyBindings | undefined {
  const slots = SAVED_BINDING_FORMAT.slots[cursor.saved.slice(cursor.at, cursor.at + 2)];
  if (slots === undefined) return undefined;
  const end = cursor.at + 2 + SAVED_BINDING_FORMAT.keyDigits * slots;
  const bindings = decodeBindings(cursor.saved.slice(cursor.at, end));
  if (bindings === undefined) return undefined;
  replacePreviousDefaults(bindings, [preset]);
  cursor.at = end;
  return bindings;
}

function readName(cursor: Cursor): string | undefined {
  const tens = DIGITS.indexOf(cursor.saved.charAt(cursor.at));
  const ones = DIGITS.indexOf(cursor.saved.charAt(cursor.at + 1));
  const length = tens * 10 + ones;
  if (tens < 0 || ones < 0 || length > SLOT_NAME_LIMIT) return undefined;
  const name = cursor.saved.slice(cursor.at + 2, cursor.at + 2 + length);
  if (name.length !== length || slotName(name) !== name) return undefined;
  cursor.at += 2 + length;
  return name;
}

function decodeOneCustom(saved: string, active: BindingPreset): LayoutSave | undefined {
  const layouts = presetLayouts();
  const cursor = { saved, at: 3 };
  for (const preset of BINDING_PRESETS) {
    const bindings = readBindings(cursor, preset);
    if (bindings === undefined) return undefined;
    layouts[preset] = bindings;
  }
  return cursor.at === saved.length ? layoutSave(layouts, active, false) : undefined;
}

function decodeCustomSlots(saved: string, active: BindingPreset, withFlag: boolean, withKeyboard: boolean): LayoutSave | undefined {
  const slot = DIGITS.indexOf(saved.charAt(3));
  if (slot < 0 || slot >= MAX_CUSTOM_SLOTS) return undefined;
  const flags = withFlag ? DIGITS.indexOf(saved.charAt(4)) : 0;
  if (flags < 0 || flags > (withKeyboard ? 7 : 1)) return undefined;
  const layouts = presetLayouts();
  const cursor = { saved, at: withFlag ? 5 : 4 };
  for (const preset of ["wasd", "standard"] as const) {
    const bindings = readBindings(cursor, preset);
    if (bindings === undefined) return undefined;
    layouts[preset] = bindings;
  }
  const customs: CustomSlot[] = [];
  while (cursor.at < saved.length && customs.length < MAX_CUSTOM_SLOTS) {
    const bindings = readBindings(cursor, "custom");
    const name = bindings === undefined ? undefined : readName(cursor);
    if (bindings === undefined || name === undefined) return undefined;
    customs.push({ bindings, name });
  }
  if (customs.length < CUSTOM_SLOT_COUNT) return undefined;
  const chosen = customs[slot];
  if (chosen === undefined || cursor.at !== saved.length) return undefined;
  layouts.custom = chosen.bindings;
  return {
    layouts, active, customs, slot,
    keyboard: withKeyboard && (flags & 1) !== 0,
    stickJump: withKeyboard && (flags & 2) !== 0,
    cStickTilt: !withKeyboard || (flags & 4) === 0,
  };
}

export function decodeLayouts(saved: string): LayoutSave | undefined {
  const version = saved.slice(0, 2);
  const active = BINDING_PRESETS[DIGITS.indexOf(saved.charAt(2))];
  if (active === undefined) return undefined;
  if (version === LAYOUT_SAVE) return decodeOneCustom(saved, active);
  if (version === SLOTS_SAVE) return decodeCustomSlots(saved, active, false, false);
  if (version === HINTS_SAVE) return decodeCustomSlots(saved, active, true, false);
  return version === KEYBOARD_SAVE ? decodeCustomSlots(saved, active, true, true) : undefined;
}
