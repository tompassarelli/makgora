import { Action } from "../input/actions";
import { keyFor, keyLabel } from "../input/keyBindings";
import { type BindingLoadResult, type BindingSettings, beginBindingCapture, captureBinding, createBindingSettings, initializeBindingSettings } from "./bindingSettings";

export const code = (character: string) => character.charCodeAt(0);

export const slots = (settings: Readonly<BindingSettings>, action: Action) => `${keyLabel(keyFor(settings.bindings, action, 0))} ${keyLabel(keyFor(settings.bindings, action, 1))}`;

export function persistedSettings(stored: { encoded: string | undefined }): BindingSettings {
  const result = (): BindingLoadResult => stored.encoded === undefined ? { kind: "empty" } : { kind: "loaded", encoded: stored.encoded };
  const settings = createBindingSettings(0, { load: (_owner, complete) => complete(result()), readLocal: () => result(), save: (_owner, encoded) => { stored.encoded = encoded; } });
  initializeBindingSettings(settings);
  return settings;
}

export function bindAttack(settings: BindingSettings, key: number): void {
  beginBindingCapture(settings, Action.attack, 0);
  captureBinding(settings, key);
}
