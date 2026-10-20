import { f32 } from "wisp/src/sim/f32";
import { bindPrototype } from "../../platform/rebind";
import { ACTION_KEY_LABELS, BINDING_PRESETS, type BindingPreset, PRESET_HINTS, PRESET_NAMES, actionFor, encodeBindings, keyLabel, presetOf } from "../input/keyBindings";
import {
  type BindingSettings,
  beginKeyCapture,
  cancelBindingCapture,
  chooseDelay,
  loadProfile,
  NO_SAVED_PROFILE,
  pickBindingPreset,
  previewStartingBindings,
  saveBindingSettings,
} from "./bindingSettings";
import { ButtonClicks, createBackdrop, createText, gameUi, placeTopLeft, setFrameText, styleMenuPanel } from "./frames";
import { MENU_FONT, MENU_STYLE } from "./hudLayout";
import { KEY_CAP_HEIGHT, keyboardCaps } from "./keyboardLayout";
import { AUTO_DELAY, nextDelayChoice } from "../netcode/delayPolicy";
import { START_HINT } from "./helpText";

export interface SettingsActions {
  closeSettings(participantId: number): void;
  delayInfo(participantId: number): string;
  recalibrate(participantId: number): void;
}

type SettingsButton = { kind: "preset"; preset: BindingPreset } | { kind: "profile" } | { kind: "save" } | { kind: "close" } | { kind: "delay" } | { kind: "recalibrate" } | { kind: "key"; key: number };

interface KeyButton {
  readonly key: number;
  readonly frame: framehandle;
  readonly action: framehandle;
}

export const PICKER_DONE = { x: f32(0.23), y: f32(0.155), width: f32(0.105), height: f32(0.032) } as const;
const BUTTON_TEXTURE = "war3mapImported\\SelectionAction.tga";
const PRESET_STEP = f32(0.148);
const PRESET_WIDTH = f32(0.142);
export const LOAD_PROFILE = { x: f32(0.564), y: f32(0.548), width: PRESET_WIDTH, height: f32(0.034) } as const;
const DIM_KEY = 105;
const LIT_KEY = 255;

export class SettingsPanel {
  readonly root: framehandle;
  private readonly hint: framehandle;
  private readonly help: framehandle;
  private readonly status: framehandle;
  private readonly delayButton: framehandle;
  private readonly delayInfo: framehandle;
  private readonly presets: readonly (readonly [BindingPreset, framehandle])[];
  private readonly keys: readonly KeyButton[];
  private readonly clicks: ButtonClicks<SettingsButton>;
  private readonly profileButton: framehandle;
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
    const button = (name: string, x: number, y: number, width: number, height: number, caption: string, target: SettingsButton, size = f32(0.011)): { readonly art: framehandle; readonly label: framehandle } => {
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
      return { art, label };
    };
    BlzFrameSetText(line("MeleeSettingsTitle", f32(0.12), f32(0.578), f32(0.3), f32(0.026), f32(0.016)), `${MENU_STYLE.gold}CONTROLS|r`);
    this.presets = BINDING_PRESETS.map((preset, index): readonly [BindingPreset, framehandle] =>
      [preset, button(`MeleeSettingsPreset${I2S(index)}`, f32(0.12) + index * PRESET_STEP, f32(0.548), PRESET_WIDTH, f32(0.034), PRESET_NAMES[preset], { kind: "preset", preset }).label]);
    this.profileButton = button("MeleeSettingsProfile", LOAD_PROFILE.x, LOAD_PROFILE.y, LOAD_PROFILE.width, LOAD_PROFILE.height, NO_SAVED_PROFILE, { kind: "profile" }).label;
    this.hint = line("MeleeSettingsHint", f32(0.12), f32(0.51), f32(0.6), f32(0.018));
    this.help = line("MeleeSettingsHelp", f32(0.12), f32(0.489), f32(0.6), f32(0.018), f32(0.0095));
    this.keys = keyboardCaps(f32(0.12), f32(0.465)).map(({ key, x, y, width }): KeyButton => {
      const { art } = button(`MeleeSettingsKey${I2S(key)}`, x, y, width, KEY_CAP_HEIGHT, "", { kind: "key", key });
      const name = text(`MeleeSettingsKeyName${I2S(key)}`, art, f32(0.011), width, f32(0.016));
      BlzFrameSetPoint(name, FRAMEPOINT_TOP, art, FRAMEPOINT_TOP, 0.0, f32(-0.007));
      BlzFrameSetTextAlignment(name, TEXT_JUSTIFY_MIDDLE, TEXT_JUSTIFY_CENTER);
      BlzFrameSetText(name, keyLabel(key));
      const action = text(`MeleeSettingsKeyAction${I2S(key)}`, art, f32(0.0075), width, f32(0.013));
      BlzFrameSetPoint(action, FRAMEPOINT_BOTTOM, art, FRAMEPOINT_BOTTOM, 0.0, f32(0.007));
      BlzFrameSetTextAlignment(action, TEXT_JUSTIFY_MIDDLE, TEXT_JUSTIFY_CENTER);
      return { key, frame: art, action };
    });
    this.status = line("MeleeSettingsStatus", f32(0.12), f32(0.218), f32(0.6), f32(0.018));
    this.delayInfo = line("MeleeSettingsDelayInfo", f32(0.12), f32(0.196), f32(0.6), f32(0.03), f32(0.0095));
    button("MeleeSettingsSave", f32(0.12), f32(0.155), f32(0.105), f32(0.032), "Save", { kind: "save" });
    button("MeleeSettingsClose", PICKER_DONE.x, PICKER_DONE.y, PICKER_DONE.width, PICKER_DONE.height, "Done", { kind: "close" });
    this.delayButton = button("MeleeSettingsDelay", f32(0.42), f32(0.155), f32(0.15), f32(0.032), "Delay: Auto", { kind: "delay" }).label;
    button("MeleeSettingsRecalibrate", f32(0.575), f32(0.155), f32(0.13), f32(0.032), "Recalibrate", { kind: "recalibrate" });
    BlzFrameSetVisible(root, false);
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
    else if (button.kind === "delay") chooseDelay(settings, nextDelayChoice(settings.delay));
    else if (button.kind === "recalibrate") this.actions.recalibrate(this.participantId);
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
    this.renderHeader(preview, this.actions.delayInfo(this.participantId));
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
    const info = this.actions.delayInfo(this.participantId);
    const signature = `${encodeBindings(settings.bindings)}${settings.message}${settings.profile}${settings.fromProfile ? "p" : "-"}${capture === undefined ? "-" : I2S(capture.action * 2 + capture.slot)}${I2S(settings.delay)}${info}`;
    if (signature === this.lastSignature) return;
    this.lastSignature = signature;
    BlzFrameSetVisible(this.root, true);
    this.renderHeader(settings, info);
    this.renderKeys(settings);
  }

  private renderHeader(settings: Readonly<BindingSettings>, info: string): void {
    const { capture } = settings;
    const selected = settings.fromProfile ? undefined : presetOf(settings.bindings);
    for (const [preset, frame] of this.presets) setFrameText(frame, preset === selected ? `${MENU_STYLE.gold}${PRESET_NAMES[preset]}|r` : PRESET_NAMES[preset]);
    setFrameText(this.profileButton, settings.profile !== "saved" ? `|cff808080${NO_SAVED_PROFILE}|r` : settings.fromProfile ? `${MENU_STYLE.gold}Load profile|r` : "Load profile");
    BlzFrameSetText(this.hint, settings.fromProfile ? `${MENU_STYLE.gold}Your saved profile is selected.|r` : selected === undefined ? "Your own keys. Save to keep them." : `${MENU_STYLE.gold}${PRESET_HINTS[selected]}|r`);
    BlzFrameSetText(this.help, capture === undefined ? `Click a lit key, then press the key you want for that action. ${START_HINT}` : "Press the new key for the flashing action. Escape cancels.");
    setFrameText(this.delayButton, settings.delay === AUTO_DELAY ? "Delay: Auto" : `Delay: ${I2S(settings.delay)} frames`);
    BlzFrameSetText(this.delayInfo, info);
    BlzFrameSetText(this.status, settings.message);
  }

  private renderKeys(settings: Readonly<BindingSettings>): void {
    const { capture } = settings;
    for (const { key, frame, action } of this.keys) {
      const bound = actionFor(settings.bindings, key);
      const index = settings.bindings.keys.indexOf(key);
      const capturing = capture !== undefined && index === capture.action * 2 + capture.slot;
      BlzFrameSetAlpha(frame, bound === undefined ? DIM_KEY : LIT_KEY);
      BlzFrameSetText(action, bound === undefined ? "" : capturing ? "|cff66ff66press...|r" : `${MENU_STYLE.gold}${ACTION_KEY_LABELS[bound]}|r`);
    }
  }
}
