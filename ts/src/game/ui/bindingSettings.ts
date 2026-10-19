



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
  actionFor,
  rebind,
  slotIndex,
} from "../input/keyBindings";
import { AUTO_DELAY, type DelayChoice, MAX_FIXED_DELAY } from "../netcode/delayPolicy";


export type BindingLoadResult = { kind: "loaded"; encoded: string } | { kind: "empty" } | { kind: "unavailable" };






export interface BindingPersistence {
  load(owner: number, complete: (result: BindingLoadResult) => void): void;
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
  delay: DelayChoice;

  ready: boolean;
  profile: SavedProfile;
  fromProfile: boolean;
  capture: BindingCapture | undefined;

  revision: number;

  message: string;
}

export function createBindingSettings(owner: number, persistence: BindingPersistence): BindingSettings {
  return { owner, persistence, bindings: presetBindings(DEFAULT_PRESET), delay: AUTO_DELAY, ready: false, profile: "unknown", fromProfile: false, capture: undefined, revision: 0, message: "Loading controls..." };
}


const DELAY_MARK = "D";
const DELAY_CODES = "012345678";

export function encodeSettings(settings: Readonly<BindingSettings>): string {
  return `${encodeBindings(settings.bindings)}${DELAY_MARK}${settings.delay === AUTO_DELAY ? "A" : DELAY_CODES.charAt(settings.delay)}`;
}

export function decodeDelay(encoded: string): { readonly bindings: string; readonly delay: DelayChoice } {
  const at = encoded.length - 2;
  if (at < 0 || encoded.charAt(at) !== DELAY_MARK) return { bindings: encoded, delay: AUTO_DELAY };
  const code = encoded.charAt(at + 1);
  const fixed = DELAY_CODES.indexOf(code);
  return { bindings: encoded.slice(0, at), delay: fixed >= 0 && fixed <= MAX_FIXED_DELAY ? fixed : AUTO_DELAY };
}

export function chooseDelay(settings: BindingSettings, delay: DelayChoice): void {
  if (!settings.ready) return;
  settings.delay = delay;
  settings.revision++;
  settings.message = delay === AUTO_DELAY ? "Delay set to Auto. Save to keep it." : `Delay set to ${delay} frames. Save to keep it.`;
}

export function initializeBindingSettings(settings: BindingSettings): void {
  settings.bindings = presetBindings(DEFAULT_PRESET);
  settings.delay = AUTO_DELAY;
  settings.persistence.load(settings.owner, (result) => {
    const stored = result.kind === "loaded" ? decodeDelay(result.encoded) : undefined;
    const saved = stored === undefined ? undefined : decodeBindings(stored.bindings);
    if (stored !== undefined && saved !== undefined) settings.delay = stored.delay;
    if (saved !== undefined) {
      settings.bindings = saved;
      settings.profile = "saved";
      settings.fromProfile = true;
      settings.message = "Saved profile loaded. Press Done to choose a fighter.";
    } else {
      settings.bindings = presetBindings(DEFAULT_PRESET);
      settings.profile = result.kind === "unavailable" ? "unavailable" : "none";
      settings.fromProfile = false;
      settings.message = result.kind === "loaded" ? `Saved controls were invalid; using ${PRESET_NAMES[DEFAULT_PRESET]} defaults.` : `${PRESET_NAMES[DEFAULT_PRESET]} controls ready. Pick a layout, then press Done.`;
    }
    settings.revision++;
    settings.ready = true;
  });
}

export function loadSavedBindings(settings: BindingSettings, done: (message: string) => void): void {
  if (!settings.ready) return;
  settings.persistence.load(settings.owner, (result) => {
    const stored = result.kind === "loaded" ? decodeDelay(result.encoded) : undefined;
    const saved = stored === undefined ? undefined : decodeBindings(stored.bindings);
    if (stored !== undefined && saved !== undefined) {
      settings.bindings = saved;
      settings.delay = stored.delay;
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
  settings.delay = AUTO_DELAY;
  settings.ready = true;
  settings.revision++;
}

export function applyBindingPreset(settings: BindingSettings, preset: BindingPreset): void {
  if (!settings.ready) return;
  settings.bindings = presetBindings(preset);
  settings.revision++;
  settings.fromProfile = false;
  settings.capture = undefined;
  settings.message = `${PRESET_NAMES[preset]} controls selected.`;
}

export function beginBindingCapture(settings: BindingSettings, action: Action, slot: KeySlot): void {
  if (!settings.ready) return;
  settings.capture = { action, slot };
  settings.message = `Press a key for ${ACTION_LABELS[action]}.`;
}


export function captureBinding(settings: BindingSettings, key: number): boolean {
  const { capture } = settings;
  if (capture === undefined) return false;
  if (rebind(settings.bindings, capture.action, capture.slot, key)) {
    settings.capture = undefined;
    settings.revision++;
    settings.fromProfile = false;
    settings.message = "Binding updated.";
  } else {
    settings.message = "That key is reserved or already assigned. Press another key.";
  }
  return true;
}

export function saveBindingSettings(settings: BindingSettings): void {
  if (!settings.ready) return;
  settings.capture = undefined;
  settings.persistence.save(settings.owner, encodeSettings(settings));
  settings.profile = "saved";
  settings.fromProfile = true;
  settings.message = "Controls saved for next time.";
}

export function cancelBindingCapture(settings: BindingSettings): void {
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
