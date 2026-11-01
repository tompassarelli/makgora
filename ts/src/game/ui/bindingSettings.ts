



import type { Action } from "../input/actions";
import {
  ACTION_LABELS,
  type BindingPreset,
  DEFAULT_PRESET,
  PRESET_NAMES,
  type KeyBindings,
  type KeySlot,
  decodeBindings,
  presetBindings,
  replacePreviousDefaults,
  presetOf,
  actionFor,
  assignKey,
  CLEAR_KEY,
  clearSlot,
  keyFor,
  keyLabel,
  slotIndex,
  unboundActions,
} from "../input/keyBindings";
import {
  type LayoutBindings,
  type LayoutSave,
  type CustomSlot,
  customSlotLabel,
  layoutSave,
  slotName,
  decodeLayouts,
  encodeLayouts,
  presetLayouts,
} from "../input/layoutSave";


export type BindingLoadResult = { kind: "loaded"; encoded: string } | { kind: "empty" } | { kind: "unavailable" };






export interface BindingPersistence {
  load(owner: number, complete: (result: BindingLoadResult) => void): void;
  readLocal(owner: number): BindingLoadResult | undefined;
  save(owner: number, encoded: string): void;
}


interface BindingCapture {
  readonly action: Action;
  readonly slot: KeySlot;
}

export type SavedProfile = "unknown" | "saved" | "none" | "unavailable";

export interface BindingSettings {
  readonly owner: number;
  readonly persistence: BindingPersistence;
  layouts: LayoutBindings;
  customs: readonly CustomSlot[];
  slot: number;
  keyboard: boolean;
  bindings: KeyBindings;

  ready: boolean;
  profile: SavedProfile;
  fromProfile: boolean;
  capture: BindingCapture | undefined;
  layout: BindingPreset;
  picking: boolean;
  naming: boolean;

  revision: number;

  message: string;
}

export function createBindingSettings(owner: number, persistence: BindingPersistence): BindingSettings {
  const { layouts, customs, slot, keyboard } = layoutSave(presetLayouts(), DEFAULT_PRESET);
  return { owner, persistence, layouts, customs, slot, keyboard, bindings: layouts[DEFAULT_PRESET], ready: false, profile: "unknown", fromProfile: false, capture: undefined, layout: DEFAULT_PRESET, picking: false, naming: false, revision: 0, message: "Loading controls..." };
}


const OLD_DELAY_MARK = "D";

function storedBindings(encoded: string): string {
  const at = encoded.length - 2;
  return at >= 0 && encoded.charAt(at) === OLD_DELAY_MARK ? encoded.slice(0, at) : encoded;
}

function adopt(settings: BindingSettings, save: LayoutSave): void {
  settings.layouts = save.layouts;
  settings.customs = save.customs;
  settings.slot = save.slot;
  settings.keyboard = save.keyboard;
  settings.layout = save.active;
  settings.picking = false;
  settings.naming = false;
  settings.bindings = save.layouts[save.active];
}

function resetLayouts(settings: BindingSettings): void {
  adopt(settings, layoutSave(presetLayouts(), DEFAULT_PRESET));
}

function decodeSaved(encoded: string): LayoutSave | undefined {
  const stored = storedBindings(encoded);
  const layouts = decodeLayouts(stored);
  if (layouts !== undefined) return layouts;
  const bindings = decodeBindings(stored);
  if (bindings === undefined) return undefined;
  replacePreviousDefaults(bindings);
  const active = presetOf(bindings) ?? "custom";
  const all = presetLayouts();
  all[active] = bindings;
  return layoutSave(all, active);
}

function applyStartingLoad(settings: BindingSettings, result: BindingLoadResult): void {
  const saved = result.kind === "loaded" ? decodeSaved(result.encoded) : undefined;
  if (saved !== undefined) {
    adopt(settings, saved);
    settings.profile = "saved";
    settings.fromProfile = true;
    settings.message = "Saved profile loaded. Press Done to choose a fighter.";
  } else {
    resetLayouts(settings);
    settings.profile = result.kind === "unavailable" ? "unavailable" : "none";
    settings.fromProfile = false;
    settings.message = result.kind === "loaded" ? `Saved controls were invalid; using ${PRESET_NAMES[DEFAULT_PRESET]} defaults.` : `${PRESET_NAMES[DEFAULT_PRESET]} controls ready. Pick a layout, then press Done.`;
  }
  settings.revision++;
  settings.ready = true;
}

export function initializeBindingSettings(settings: BindingSettings): void {
  resetLayouts(settings);
  settings.persistence.load(settings.owner, result => applyStartingLoad(settings, result));
}

export function previewStartingBindings(settings: Readonly<BindingSettings>): BindingSettings | undefined {
  const result = settings.persistence.readLocal(settings.owner);
  if (result === undefined) return undefined;
  const preview = createBindingSettings(settings.owner, settings.persistence);
  applyStartingLoad(preview, result);
  return preview;
}

export function loadSavedBindings(settings: BindingSettings, done: (message: string) => void): void {
  if (!settings.ready) return;
  settings.persistence.load(settings.owner, (result) => {
    const saved = result.kind === "loaded" ? decodeSaved(result.encoded) : undefined;
    if (saved !== undefined) {
      adopt(settings, saved);
      settings.capture = undefined;
      settings.revision++;
      settings.profile = "saved";
      settings.fromProfile = true;
      settings.message = "Saved controls loaded.";
    } else {
      if (result.kind === "empty") settings.profile = "none";
      settings.message = result.kind === "loaded" ? "Saved controls were invalid; kept current controls." : result.kind === "empty" ? "No saved controls yet. Type -save to keep these." : "Saved controls are unavailable.";
    }
    done(settings.message);
  });
}


export function useDefaultBindings(settings: BindingSettings): void {
  resetLayouts(settings);
  settings.ready = true;
  settings.revision++;
}

export function applyBindingPreset(settings: BindingSettings, preset: BindingPreset): void {
  if (!settings.ready) return;
  settings.layout = preset;
  settings.bindings = settings.layouts[preset];
  settings.revision++;
  settings.fromProfile = false;
  settings.capture = undefined;
  settings.message = `${PRESET_NAMES[preset]} controls selected.`;
}

export function beginBindingCapture(settings: BindingSettings, action: Action, slot: KeySlot): void {
  if (!settings.ready) return;
  settings.capture = { action, slot };
  settings.message = `Press a key for ${ACTION_LABELS[action]}. Delete clears it, Escape cancels.`;
}

function edited(settings: BindingSettings, message: string): void {
  settings.capture = undefined;
  settings.revision++;
  settings.fromProfile = false;
  settings.message = message;
}

function selectCustom(settings: BindingSettings, bindings: KeyBindings): void {
  const custom = settings.customs[settings.slot];
  if (custom !== undefined) custom.bindings = bindings;
  settings.layouts.custom = bindings;
  settings.layout = "custom";
  settings.bindings = bindings;
}

const editableBindings = (settings: Readonly<BindingSettings>): KeyBindings => settings.layout === "custom" ? settings.bindings : { keys: settings.bindings.keys.slice() };

function finishEdit(settings: BindingSettings, target: KeyBindings, message: string): void {
  if (target === settings.bindings) {
    edited(settings, message);
    return;
  }
  const from = PRESET_NAMES[settings.layout];
  selectCustom(settings, target);
  edited(settings, message);
  saveBindingSettings(settings);
  settings.fromProfile = false;
  settings.message = `${message} ${from} stays as it was; your keys are in Custom and saved.`;
}

export function customizeLayout(settings: BindingSettings): void {
  if (!settings.ready) return;
  if (settings.layout === "custom") {
    settings.message = "Custom is already selected. Edit any key.";
    return;
  }
  const from = PRESET_NAMES[settings.layout];
  selectCustom(settings, editableBindings(settings));
  edited(settings, `${from} copied to Custom. Edits go to Custom.`);
}

function clearedMessage(bindings: Readonly<KeyBindings>, action: Action, key: number | undefined): string {
  const unbound = keyFor(bindings, action, 0) === undefined && keyFor(bindings, action, 1) === undefined;
  return unbound ? `${ACTION_LABELS[action]} is now unbound.` : `${keyLabel(key)} cleared from ${ACTION_LABELS[action]}.`;
}

export function captureBinding(settings: BindingSettings, key: number): boolean {
  const { capture } = settings;
  if (capture === undefined) return false;
  const target = editableBindings(settings);
  if (key === CLEAR_KEY) {
    const old = keyFor(target, capture.action, capture.slot);
    clearSlot(target, capture.action, capture.slot);
    finishEdit(settings, target, clearedMessage(target, capture.action, old));
    return true;
  }
  const result = assignKey(target, capture.action, capture.slot, key);
  if (result.kind === "swapped") finishEdit(settings, target, `Swapped with ${ACTION_LABELS[result.with]}.`);
  else if (result.kind === "bound") finishEdit(settings, target, "Binding updated.");
  else if (result.kind === "reserved") settings.message = `${result.reason}. Press another key.`;
  else settings.message = "That key can't be bound. Press another key.";
  return true;
}

export function clearKey(settings: BindingSettings, key: number): void {
  if (!settings.ready) return;
  const action = key === 0 ? undefined : actionFor(settings.bindings, key);
  if (action === undefined) return;
  const slot = settings.bindings.keys.indexOf(key) === slotIndex(action, 0) ? 0 : 1;
  const target = editableBindings(settings);
  clearSlot(target, action, slot);
  finishEdit(settings, target, clearedMessage(target, action, key));
}

export function bindFirstUnbound(settings: BindingSettings): void {
  const action = unboundActions(settings.bindings)[0];
  if (action !== undefined) beginBindingCapture(settings, action, 0);
}

export function resetToLayout(settings: BindingSettings): void {
  if (!settings.ready) return;
  const stock = presetBindings(settings.layout);
  if (settings.layout === "custom") selectCustom(settings, stock);
  else {
    settings.bindings = stock;
    settings.layouts[settings.layout] = stock;
  }
  edited(settings, `${PRESET_NAMES[settings.layout]} defaults restored. Save to keep them.`);
}

export function saveBindingSettings(settings: BindingSettings): void {
  if (!settings.ready) return;
  settings.capture = undefined;
  settings.persistence.save(settings.owner, encodeLayouts({ layouts: settings.layouts, active: settings.layout, customs: settings.customs, slot: settings.slot, keyboard: settings.keyboard }));
  settings.profile = "saved";
  settings.fromProfile = true;
  settings.message = "Controls saved for next time.";
}

export const PREVIEW_KEY = 0x48;

export const previewKeyFree = (settings: Readonly<BindingSettings>): boolean => actionFor(settings.bindings, PREVIEW_KEY) === undefined;

export function toggleKeyboardPreview(settings: BindingSettings): void {
  if (!settings.ready) return;
  settings.keyboard = !settings.keyboard;
  saveBindingSettings(settings);
  settings.message = settings.keyboard ? "The keyboard shows in game." : "The keyboard is hidden in game.";
}

export function cancelBindingCapture(settings: BindingSettings): void {
  if (settings.capture !== undefined) settings.message = "Rebind cancelled.";
  settings.capture = undefined;
}

export function pickBindingPreset(settings: BindingSettings, preset: BindingPreset): void {
  if (!settings.ready) return;
  applyBindingPreset(settings, preset);
  saveBindingSettings(settings);
  settings.fromProfile = false;
  settings.message = `${PRESET_NAMES[preset]} controls saved as your profile.`;
}

export function beginKeyCapture(settings: BindingSettings, key: number): void {
  const index = key === 0 ? -1 : settings.bindings.keys.indexOf(key);
  if (index < 0) {
    if (settings.ready) settings.message = "That key does nothing yet. Click a lit key to move its action.";
    return;
  }
  const action = actionFor(settings.bindings, key);
  if (action !== undefined) beginBindingCapture(settings, action, index === slotIndex(action, 0) ? 0 : 1);
}

export const slotLabel = (settings: Readonly<BindingSettings>, slot = settings.slot): string => customSlotLabel(settings.customs, slot);

export function loadProfile(settings: BindingSettings): void {
  if (!settings.ready) return;
  endNaming(settings);
  settings.picking = !settings.picking;
  if (settings.picking) settings.message = "Pick a Custom slot to load.";
}

export function pickCustomSlot(settings: BindingSettings, slot: number): void {
  const custom = settings.customs[slot];
  if (!settings.ready || custom === undefined) return;
  settings.slot = slot;
  settings.picking = false;
  settings.capture = undefined;
  selectCustom(settings, custom.bindings);
  settings.revision++;
  saveBindingSettings(settings);
  settings.message = `${slotLabel(settings)} loaded and saved as your profile.`;
}

export function beginNaming(settings: BindingSettings): void {
  if (!settings.ready) return;
  if (settings.naming) {
    endNaming(settings);
    return;
  }
  if (settings.layout !== "custom") selectCustom(settings, settings.layouts.custom);
  settings.capture = undefined;
  settings.picking = false;
  settings.naming = true;
  settings.revision++;
  settings.message = `Type a name for ${slotLabel(settings)}, then press Enter.`;
}

export function nameSlot(settings: BindingSettings, typed: string): void {
  const custom = settings.customs[settings.slot];
  if (!settings.naming || custom === undefined) return;
  custom.name = slotName(typed);
  settings.revision++;
}

export function endNaming(settings: BindingSettings): void {
  if (!settings.naming) return;
  settings.naming = false;
  settings.revision++;
  saveBindingSettings(settings);
  settings.message = `Slot ${settings.slot + 1} is named ${slotLabel(settings)} and saved.`;
}

export function deleteProfile(settings: BindingSettings): void {
  const custom = settings.customs[settings.slot];
  if (!settings.ready || custom === undefined) return;
  endNaming(settings);
  settings.picking = false;
  const deleted = slotLabel(settings);
  custom.name = "";
  selectCustom(settings, presetBindings("custom"));
  edited(settings, `${deleted} deleted.`);
  saveBindingSettings(settings);
  settings.message = `${deleted} deleted. ${slotLabel(settings)} is back on the Custom defaults.`;
}
