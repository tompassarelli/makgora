import { f32 } from "wisp/src/sim/f32";
import { bindPrototype } from "../../platform/rebind";
import { ACTION_KEY_LABELS, BINDING_PRESETS, type BindingPreset, PRESET_HINTS, PRESET_NAMES, actionFor, encodeBindings, keyLabel, presetOf, unboundActions } from "../input/keyBindings";
import {
  type BindingSettings,
  beginKeyCapture,
  bindFirstUnbound,
  cancelBindingCapture,
  clearKey,
  loadProfile,
  NO_SAVED_PROFILE,
  pickBindingPreset,
  previewStartingBindings,
  resetToLayout,
  saveBindingSettings,
} from "./bindingSettings";
import { ButtonClicks, createBackdrop, createText, gameUi, placeTopLeft, setFrameText, styleMenuPanel } from "./frames";
import { MENU_FONT, MENU_STYLE } from "./hudLayout";
import { KEY_CAP_HEIGHT, keyboardCaps } from "./keyboardLayout";
import { START_HINT } from "./helpText";

export interface SettingsActions {
  closeSettings(participantId: number): void;
}

type SettingsButton = { kind: "preset"; preset: BindingPreset } | { kind: "profile" } | { kind: "save" } | { kind: "close" } | { kind: "key"; key: number } | { kind: "clear"; key: number } | { kind: "reset" } | { kind: "bindUnbound" };

interface KeyButton {
  readonly key: number;
  readonly frame: framehandle;
  readonly action: framehandle;
  readonly clear: readonly framehandle[];
}

export const PICKER_DONE = { x: f32(0.23), y: f32(0.155), width: f32(0.105), height: f32(0.032) } as const;
const BUTTON_TEXTURE = "war3mapImported\\SelectionAction.tga";
const PRESET_STEP = f32(0.148);
const PRESET_WIDTH = f32(0.142);
export const LOAD_PROFILE = { x: f32(0.564), y: f32(0.548), width: PRESET_WIDTH, height: f32(0.034) } as const;
export const presetButton = (index: number) => ({ x: f32(0.12) + index * PRESET_STEP, y: f32(0.548), width: PRESET_WIDTH, height: f32(0.034) });
const DIM_KEY = 105;
const LIT_KEY = 255;
const CLEAR_SIZE = f32(0.012);

export class SettingsPanel {
  readonly root: framehandle;
  private readonly hint: framehandle;
  private readonly help: framehandle;
  private readonly status: framehandle;
  private readonly presets: readonly (readonly [BindingPreset, framehandle])[];
  private readonly keys: readonly KeyButton[];
  private readonly clicks: ButtonClicks<SettingsButton>;
  private readonly profileButton: framehandle;
  private readonly bindButton: { readonly frames: readonly framehandle[]; readonly label: framehandle };
  private open = false;
  private lastSignature = "";
  private readonly local: boolean;

  constructor(
    private readonly settings: BindingSettings,
    private actions: SettingsActions,
    readonly participantId: number,
  ) {
    const suffix = I2S(participantId);
    this.local = GetLocalPlayer() === Player(participantId);
    this.clicks = new ButtonClicks(`ui.settings.${suffix}.click`, (button, clicker) => this.click(button, clicker));
    const root = createBackdrop(`MeleeSettingsRoot${suffix}`, gameUi(), participantId);
    BlzFrameSetLevel(styleMenuPanel(root, `MeleeSettingsRoot${suffix}`), 30);
    placeTopLeft(root, f32(0.09), f32(0.595));
    BlzFrameSetSize(root, f32(0.66), f32(0.53));
    BlzFrameSetLevel(root, 30);
    this.root = root;
    const text = (name: string, parent: framehandle, size: number, width: number, height: number): framehandle => {
      const frame = createText(`${name}${suffix}`, parent, participantId);
      BlzFrameSetSize(frame, width, height);
      BlzFrameSetFont(frame, MENU_FONT, size, 0);
      BlzFrameSetEnable(frame, false);
      BlzFrameSetLevel(frame, parent === root ? 31 : 32);
      return frame;
    };
    const line = (name: string, x: number, y: number, width: number, height: number, size = f32(0.011)): framehandle => {
      const frame = text(name, root, size, width, height);
      placeTopLeft(frame, x, y);
      return frame;
    };
    const button = (name: string, x: number, y: number, width: number, height: number, caption: string, target: SettingsButton, size = f32(0.011)): { readonly art: framehandle; readonly label: framehandle; readonly hotspot: framehandle } => {
      const art = createBackdrop(`${name}Art${suffix}`, root, participantId);
      BlzFrameSetTexture(art, BUTTON_TEXTURE, 0, true);
      placeTopLeft(art, x, y);
      BlzFrameSetSize(art, width, height);
      BlzFrameSetEnable(art, false);
      BlzFrameSetLevel(art, 31);
      const label = text(name, art, size, width, height);
      BlzFrameSetPoint(label, FRAMEPOINT_CENTER, art, FRAMEPOINT_CENTER, 0.0, 0.0);
      BlzFrameSetTextAlignment(label, TEXT_JUSTIFY_MIDDLE, TEXT_JUSTIFY_CENTER);
      setFrameText(label, caption);
      const hotspot = BlzCreateFrameByType("BUTTON", `${name}Hit${suffix}`, root, "", participantId);
      placeTopLeft(hotspot, x, y);
      BlzFrameSetSize(hotspot, width, height);
      BlzFrameSetLevel(hotspot, 33);
      this.clicks.add(hotspot, target, undefined, "native");
      return { art, label, hotspot };
    };
    BlzFrameSetText(line("MeleeSettingsTitle", f32(0.12), f32(0.578), f32(0.3), f32(0.026), f32(0.016)), `${MENU_STYLE.gold}CONTROLS|r`);
    this.presets = BINDING_PRESETS.map((preset, index): readonly [BindingPreset, framehandle] => {
      const { x, y, width, height } = presetButton(index);
      return [preset, button(`MeleeSettingsPreset${I2S(index)}`, x, y, width, height, PRESET_NAMES[preset], { kind: "preset", preset }).label];
    });
    this.profileButton = button("MeleeSettingsProfile", LOAD_PROFILE.x, LOAD_PROFILE.y, LOAD_PROFILE.width, LOAD_PROFILE.height, NO_SAVED_PROFILE, { kind: "profile" }).label;
    this.hint = line("MeleeSettingsHint", f32(0.12), f32(0.51), f32(0.6), f32(0.018));
    this.help = line("MeleeSettingsHelp", f32(0.12), f32(0.4815), f32(0.6), f32(0.014), f32(0.0095));
    this.keys = keyboardCaps(f32(0.12), f32(0.465)).map(({ key, x, y, width }): KeyButton => {
      const { art } = button(`MeleeSettingsKey${I2S(key)}`, x, y, width, KEY_CAP_HEIGHT, "", { kind: "key", key });
      const clear = this.clearCross(root, key, f32(f32(x + width) - CLEAR_SIZE), y);
      const name = text(`MeleeSettingsKeyName${I2S(key)}`, art, f32(0.011), width, f32(0.016));
      BlzFrameSetPoint(name, FRAMEPOINT_TOP, art, FRAMEPOINT_TOP, 0.0, f32(-0.007));
      BlzFrameSetTextAlignment(name, TEXT_JUSTIFY_MIDDLE, TEXT_JUSTIFY_CENTER);
      BlzFrameSetText(name, keyLabel(key));
      const action = text(`MeleeSettingsKeyAction${I2S(key)}`, art, f32(0.0075), width, f32(0.013));
      BlzFrameSetPoint(action, FRAMEPOINT_BOTTOM, art, FRAMEPOINT_BOTTOM, 0.0, f32(0.007));
      BlzFrameSetTextAlignment(action, TEXT_JUSTIFY_MIDDLE, TEXT_JUSTIFY_CENTER);
      return { key, frame: art, action, clear };
    });
    this.status = line("MeleeSettingsStatus", f32(0.12), f32(0.218), f32(0.6), f32(0.018));
    button("MeleeSettingsSave", f32(0.12), f32(0.155), f32(0.105), f32(0.032), "Save", { kind: "save" });
    button("MeleeSettingsClose", PICKER_DONE.x, PICKER_DONE.y, PICKER_DONE.width, PICKER_DONE.height, "Done", { kind: "close" });
    button("MeleeSettingsReset", f32(0.34), f32(0.155), f32(0.14), f32(0.032), "Reset to layout", { kind: "reset" });
    const bind = button("MeleeSettingsBind", f32(0.49), f32(0.155), f32(0.17), f32(0.032), "", { kind: "bindUnbound" });
    this.bindButton = { frames: [bind.art, bind.hotspot], label: bind.label };
    BlzFrameSetVisible(root, false);
  }

  private clearCross(root: framehandle, key: number, x: number, y: number): readonly framehandle[] {
    const cross = createText(`MeleeSettingsKeyClear${I2S(key)}${I2S(this.participantId)}`, root, this.participantId);
    BlzFrameSetSize(cross, CLEAR_SIZE, CLEAR_SIZE);
    BlzFrameSetFont(cross, MENU_FONT, f32(0.009), 0);
    BlzFrameSetEnable(cross, false);
    placeTopLeft(cross, x, y);
    BlzFrameSetLevel(cross, 34);
    BlzFrameSetTextAlignment(cross, TEXT_JUSTIFY_MIDDLE, TEXT_JUSTIFY_CENTER);
    BlzFrameSetText(cross, "|cffff6060x|r");
    const hit = BlzCreateFrameByType("BUTTON", `MeleeSettingsKeyClearHit${I2S(key)}`, root, "", this.participantId);
    placeTopLeft(hit, x, y);
    BlzFrameSetSize(hit, CLEAR_SIZE, CLEAR_SIZE);
    BlzFrameSetLevel(hit, 35);
    this.clicks.add(hit, { kind: "clear", key }, undefined, "native");
    return [cross, hit];
  }

  bindActions(actions: SettingsActions): void {
    this.actions = actions;
    bindPrototype(this.clicks, ButtonClicks.prototype);
    this.clicks.bindHandler((button, clicker) => this.click(button, clicker));
  }

  destroy(): void {
    this.clicks.destroy();
    BlzDestroyFrame(this.root);
  }

  private click(button: SettingsButton, clicker: player): void {
    const { settings } = this;
    if (clicker !== Player(this.participantId) || !settings.ready) return;
    if (button.kind === "preset") pickBindingPreset(settings, button.preset);
    else if (button.kind === "profile") loadProfile(settings);
    else if (button.kind === "save") saveBindingSettings(settings);
    else if (button.kind === "close") this.close();
    else if (button.kind === "clear") clearKey(settings, button.key);
    else if (button.kind === "reset") resetToLayout(settings);
    else if (button.kind === "bindUnbound") bindFirstUnbound(settings);
    else beginKeyCapture(settings, button.key);
  }

  isOpen(): boolean {
    return this.open;
  }


  preview(): void {
    if (this.open || this.settings.ready) return;
    const preview = previewStartingBindings(this.settings);
    if (preview === undefined) return;
    BlzFrameSetVisible(this.root, true);
    this.renderHeader(preview);
    this.renderKeys(preview);
  }

  endPreview(): void {
    if (!this.open) BlzFrameSetVisible(this.root, false);
  }

  show(): void {
    if (!this.settings.ready) return;
    this.open = true;
    this.lastSignature = "";
    this.update();
  }


  close(): void {
    this.open = false;
    cancelBindingCapture(this.settings);
    BlzFrameSetVisible(this.root, false);
    this.actions.closeSettings(this.participantId);
  }


  update(): void {
    if (!this.local || !this.open) return;
    const { settings } = this;
    const { capture } = settings;
    const signature = `${settings.layout}${encodeBindings(settings.bindings)}${settings.message}${settings.profile}${settings.fromProfile ? "p" : "-"}${capture === undefined ? "-" : I2S(capture.action * 2 + capture.slot)}`;
    if (signature === this.lastSignature) return;
    this.lastSignature = signature;
    BlzFrameSetVisible(this.root, true);
    this.renderHeader(settings);
    this.renderKeys(settings);
  }

  private renderHeader(settings: Readonly<BindingSettings>): void {
    const { capture } = settings;
    const selected = settings.fromProfile ? undefined : settings.layout;
    const stock = presetOf(settings.bindings);
    for (const [preset, frame] of this.presets) setFrameText(frame, preset === selected ? `${MENU_STYLE.gold}${PRESET_NAMES[preset]}|r` : PRESET_NAMES[preset]);
    setFrameText(this.profileButton, settings.profile !== "saved" ? `|cff808080${NO_SAVED_PROFILE}|r` : settings.fromProfile ? `${MENU_STYLE.gold}Load profile|r` : "Load profile");
    const unbound = unboundActions(settings.bindings);
    const unboundText = unbound.map(action => ACTION_KEY_LABELS[action]).join(", ");
    BlzFrameSetText(this.hint, unbound.length > 0 ? `${MENU_STYLE.gold}Unbound: ${unboundText}.|r Save to keep these keys.` : settings.fromProfile ? `${MENU_STYLE.gold}Your saved profile is selected.|r` : stock === undefined ? "Your own keys. Save to keep them." : `${MENU_STYLE.gold}${PRESET_HINTS[stock]}|r`);
    BlzFrameSetText(this.help, capture === undefined ? `Click a lit key, then press its new key; its x clears it. ${START_HINT}` : "Press the new key for the flashing action. Delete clears it, Escape cancels.");
    const first = unbound[0];
    for (const frame of this.bindButton.frames) BlzFrameSetVisible(frame, first !== undefined);
    if (first !== undefined) setFrameText(this.bindButton.label, `Bind ${ACTION_KEY_LABELS[first]}`);
    BlzFrameSetText(this.status, settings.message);
  }

  private renderKeys(settings: Readonly<BindingSettings>): void {
    const { capture } = settings;
    for (const { key, frame, action, clear } of this.keys) {
      const bound = actionFor(settings.bindings, key);
      const index = settings.bindings.keys.indexOf(key);
      const capturing = capture !== undefined && index === capture.action * 2 + capture.slot;
      BlzFrameSetAlpha(frame, bound === undefined ? DIM_KEY : LIT_KEY);
      for (const part of clear) BlzFrameSetVisible(part, bound !== undefined);
      BlzFrameSetText(action, bound === undefined ? "" : capturing ? "|cff66ff66press...|r" : `${MENU_STYLE.gold}${ACTION_KEY_LABELS[bound]}|r`);
    }
  }
}
