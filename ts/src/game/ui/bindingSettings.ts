



import type { Action } from "../input/actions";
import {
  ACTION_LABELS,
  type BindingPreset,
  DEFAULT_PRESET,
  PRESET_NAMES,
  type KeyBindings,
  type KeySlot,
  decodeBindings,
  encodeBindings,
  presetBindings,
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
  bindings: KeyBindings;

  ready: boolean;
  profile: SavedProfile;
  fromProfile: boolean;
  capture: BindingCapture | undefined;
  layout: BindingPreset;

  revision: number;

  message: string;
}

export function createBindingSettings(owner: number, persistence: BindingPersistence): BindingSettings {
  return { owner, persistence, bindings: presetBindings(DEFAULT_PRESET), ready: false, profile: "unknown", fromProfile: false, capture: undefined, layout: DEFAULT_PRESET, revision: 0, message: "Loading controls..." };
}


const OLD_DELAY_MARK = "D";

function storedBindings(encoded: string): string {
  const at = encoded.length - 2;
  return at >= 0 && encoded.charAt(at) === OLD_DELAY_MARK ? encoded.slice(0, at) : encoded;
}

function applyStartingLoad(settings: BindingSettings, result: BindingLoadResult): void {
  const saved = result.kind === "loaded" ? decodeBindings(storedBindings(result.encoded)) : undefined;
  if (saved !== undefined) {
    settings.bindings = saved;
    settings.layout = presetOf(saved) ?? settings.layout;
    settings.profile = "saved";
    settings.fromProfile = true;
    settings.message = "Saved profile loaded. Press Done to choose a fighter.";
  } else {
    settings.bindings = presetBindings(DEFAULT_PRESET);
    settings.layout = DEFAULT_PRESET;
    settings.profile = result.kind === "unavailable" ? "unavailable" : "none";
    settings.fromProfile = false;
    settings.message = result.kind === "loaded" ? `Saved controls were invalid; using ${PRESET_NAMES[DEFAULT_PRESET]} defaults.` : `${PRESET_NAMES[DEFAULT_PRESET]} controls ready. Pick a layout, then press Done.`;
  }
  settings.revision++;
  settings.ready = true;
}

export function initializeBindingSettings(settings: BindingSettings): void {
  settings.bindings = presetBindings(DEFAULT_PRESET);
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
    const saved = result.kind === "loaded" ? decodeBindings(storedBindings(result.encoded)) : undefined;
    if (saved !== undefined) {
      settings.bindings = saved;
      settings.layout = presetOf(saved) ?? settings.layout;
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
  settings.bindings = presetBindings(DEFAULT_PRESET);
  settings.ready = true;
  settings.revision++;
}

export function applyBindingPreset(settings: BindingSettings, preset: BindingPreset): void {
  if (!settings.ready) return;
  settings.bindings = presetBindings(preset);
  settings.layout = preset;
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

function clearedMessage(settings: Readonly<BindingSettings>, action: Action, key: number | undefined): string {
  const unbound = keyFor(settings.bindings, action, 0) === undefined && keyFor(settings.bindings, action, 1) === undefined;
  return unbound ? `${ACTION_LABELS[action]} is now unbound.` : `${keyLabel(key)} cleared from ${ACTION_LABELS[action]}.`;
}

export function captureBinding(settings: BindingSettings, key: number): boolean {
  const { capture } = settings;
  if (capture === undefined) return false;
  if (key === CLEAR_KEY) {
    const old = keyFor(settings.bindings, capture.action, capture.slot);
    clearSlot(settings.bindings, capture.action, capture.slot);
    edited(settings, clearedMessage(settings, capture.action, old));
    return true;
  }
  const result = assignKey(settings.bindings, capture.action, capture.slot, key);
  if (result.kind === "swapped") edited(settings, `Swapped with ${ACTION_LABELS[result.with]}.`);
  else if (result.kind === "bound") edited(settings, "Binding updated.");
  else if (result.kind === "reserved") settings.message = `${result.reason}. Press another key.`;
  else settings.message = "That key can't be bound. Press another key.";
  return true;
}

export function clearKey(settings: BindingSettings, key: number): void {
  if (!settings.ready) return;
  const action = key === 0 ? undefined : actionFor(settings.bindings, key);
  if (action === undefined) return;
  const slot = settings.bindings.keys.indexOf(key) === slotIndex(action, 0) ? 0 : 1;
  clearSlot(settings.bindings, action, slot);
  edited(settings, clearedMessage(settings, action, key));
}

export function bindFirstUnbound(settings: BindingSettings): void {
  const action = unboundActions(settings.bindings)[0];
  if (action !== undefined) beginBindingCapture(settings, action, 0);
}

export function resetToLayout(settings: BindingSettings): void {
  if (!settings.ready) return;
  settings.bindings = presetBindings(settings.layout);
  edited(settings, `${PRESET_NAMES[settings.layout]} defaults restored. Save to keep them.`);
}

export function saveBindingSettings(settings: BindingSettings): void {
  if (!settings.ready) return;
  settings.capture = undefined;
  settings.persistence.save(settings.owner, encodeBindings(settings.bindings));
  settings.profile = "saved";
  settings.fromProfile = true;
  settings.message = "Controls saved for next time.";
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

export const NO_SAVED_PROFILE = "No saved profile";

export function loadProfile(settings: BindingSettings): void {
  if (!settings.ready) return;
  if (settings.profile !== "saved") {
    settings.message = settings.profile === "unavailable" ? "Saved controls are unavailable." : `${NO_SAVED_PROFILE} yet. Pick a layout or set your keys, then Save.`;
    return;
  }
  loadSavedBindings(settings, () => undefined);
}
