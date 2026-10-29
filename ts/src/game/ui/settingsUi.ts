import { on, trampoline } from "wisp/src/platform/dispatch";
import { f32 } from "wisp/src/sim/f32";
import { bindPrototype } from "../../platform/rebind";
import { ACTION_KEY_LABELS, BINDING_PRESETS, type BindingPreset, PRESET_HINTS, PRESET_NAMES, actionFor, encodeBindings, keyLabel, presetOf, unboundActions } from "../input/keyBindings";
import { CUSTOM_SLOT_COUNT, SLOT_NAME_LIMIT } from "../input/layoutSave";
import {
  type BindingSettings,
  beginKeyCapture,
  beginNaming,
  bindFirstUnbound,
  cancelBindingCapture,
  clearKey,
  customizeLayout,
  endNaming,
  loadProfile,
  nameSlot,
  pickBindingPreset,
  pickCustomSlot,
  previewStartingBindings,
  resetToLayout,
  saveBindingSettings,
  slotLabel,
} from "./bindingSettings";
import { ButtonClicks, createBackdrop, createText, gameUi, placeTopLeft, setFrameText, styleMenuPanel } from "./frames";
import { MENU_FONT, MENU_STYLE } from "./hudLayout";
import { KEY_CAP_HEIGHT, keyboardCaps } from "./keyboardLayout";
import { START_HINT } from "./helpText";

export interface SettingsActions {
  closeSettings(participantId: number): void;
}

type SettingsButton = { kind: "preset"; preset: BindingPreset } | { kind: "customize" } | { kind: "profile" } | { kind: "slot"; slot: number } | { kind: "name" } | { kind: "save" } | { kind: "close" } | { kind: "key"; key: number } | { kind: "clear"; key: number } | { kind: "reset" } | { kind: "bindUnbound" };

interface KeyButton {
  readonly key: number;
  readonly frame: framehandle;
  readonly action: framehandle;
  readonly clear: readonly framehandle[];
}

export const PICKER_DONE = { x: f32(0.23), y: f32(0.155), width: f32(0.105), height: f32(0.032) } as const;
const BUTTON_TEXTURE = "war3mapImported\\SelectionAction.tga";
const PRESET_STEP = f32(0.122);
const PRESET_WIDTH = f32(0.118);
export const presetButton = (index: number) => ({ x: f32(0.12) + index * PRESET_STEP, y: f32(0.548), width: PRESET_WIDTH, height: f32(0.034) });
const CUSTOMIZE = presetButton(BINDING_PRESETS.length);
export const LOAD_PROFILE = presetButton(BINDING_PRESETS.length + 1);
export const profileSlotButton = (slot: number) => ({ x: LOAD_PROFILE.x, y: [f32(0.512), f32(0.476), f32(0.44)][slot] ?? LOAD_PROFILE.y, width: LOAD_PROFILE.width, height: f32(0.034) });
export const NAME_SLOT = { x: LOAD_PROFILE.x, y: f32(0.584), width: LOAD_PROFILE.width, height: f32(0.03) } as const;
export const NAME_BOX = { x: f32(0.39), y: f32(0.585), width: f32(0.21), height: f32(0.032) } as const;
const DIM_KEY = 105;
const LIT_KEY = 255;
const CLEAR_SIZE = f32(0.012);

type SlotButton = { readonly frames: readonly framehandle[]; readonly label: framehandle };

function createNameBox(root: framehandle, participantId: number): framehandle {
  const box = BlzCreateFrameByType("EDITBOX", `MeleeSettingsNameBox${I2S(participantId)}`, root, "EscMenuEditBoxTemplate", participantId);
  placeTopLeft(box, NAME_BOX.x, NAME_BOX.y);
  BlzFrameSetSize(box, NAME_BOX.width, NAME_BOX.height);
  BlzFrameSetTextSizeLimit(box, SLOT_NAME_LIMIT);
  BlzFrameSetLevel(box, 33);
  BlzFrameSetVisible(box, false);
  return box;
}

function profileSlots(button: (slot: number, x: number, y: number, width: number, height: number) => { readonly art: framehandle; readonly label: framehandle; readonly hotspot: framehandle }): readonly SlotButton[] {
  const slots: SlotButton[] = [];
  for (let slot = 0; slot < CUSTOM_SLOT_COUNT; slot++) {
    const { x, y, width, height } = profileSlotButton(slot);
    const pick = button(slot, x, y, width, height);
    slots.push({ frames: [pick.art, pick.hotspot], label: pick.label });
  }
  return slots;
}

function leaveSlotModes(settings: BindingSettings, kind: SettingsButton["kind"]): void {
  if (kind !== "name") endNaming(settings);
  if (kind !== "profile" && kind !== "slot") settings.picking = false;
}

export class SettingsPanel {
  readonly root: framehandle;
  private readonly hint: framehandle;
  private readonly help: framehandle;
  private readonly status: framehandle;
  private readonly presets: readonly (readonly [BindingPreset, framehandle])[];
  private readonly keys: readonly KeyButton[];
  private readonly clicks: ButtonClicks<SettingsButton>;
  private readonly profileButton: framehandle;
  private readonly slotButtons: readonly SlotButton[];
  private readonly nameButton: framehandle;
  private readonly nameBox: framehandle;
  private readonly nameEvents: trigger;
  private readonly bindButton: { readonly frames: readonly framehandle[]; readonly label: framehandle };
  private open = false;
  private nameShown = false;
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
    const button = (name: string, x: number, y: number, width: number, height: number, caption: string, target: SettingsButton, size = f32(0.011), level = 31): { readonly art: framehandle; readonly label: framehandle; readonly hotspot: framehandle } => {
      const art = createBackdrop(`${name}Art${suffix}`, root, participantId);
      BlzFrameSetTexture(art, BUTTON_TEXTURE, 0, true);
      placeTopLeft(art, x, y);
      BlzFrameSetSize(art, width, height);
      BlzFrameSetEnable(art, false);
      BlzFrameSetLevel(art, level);
      const label = text(name, art, size, width, height);
      BlzFrameSetPoint(label, FRAMEPOINT_CENTER, art, FRAMEPOINT_CENTER, 0.0, 0.0);
      BlzFrameSetTextAlignment(label, TEXT_JUSTIFY_MIDDLE, TEXT_JUSTIFY_CENTER);
      setFrameText(label, caption);
      const hotspot = BlzCreateFrameByType("BUTTON", `${name}Hit${suffix}`, root, "", participantId);
      placeTopLeft(hotspot, x, y);
      BlzFrameSetSize(hotspot, width, height);
      BlzFrameSetLevel(hotspot, level + 2);
      this.clicks.add(hotspot, target, undefined, "native");
      return { art, label, hotspot };
    };
    BlzFrameSetText(line("MeleeSettingsTitle", f32(0.12), f32(0.578), f32(0.3), f32(0.026), f32(0.016)), `${MENU_STYLE.gold}CONTROLS|r`);
    this.presets = BINDING_PRESETS.map((preset, index): readonly [BindingPreset, framehandle] => {
      const { x, y, width, height } = presetButton(index);
      return [preset, button(`MeleeSettingsPreset${I2S(index)}`, x, y, width, height, PRESET_NAMES[preset], { kind: "preset", preset }).label];
    });
    button("MeleeSettingsCustomize", CUSTOMIZE.x, CUSTOMIZE.y, CUSTOMIZE.width, CUSTOMIZE.height, "Customize", { kind: "customize" });
    this.profileButton = button("MeleeSettingsProfile", LOAD_PROFILE.x, LOAD_PROFILE.y, LOAD_PROFILE.width, LOAD_PROFILE.height, "Load profile", { kind: "profile" }).label;
    this.nameButton = button("MeleeSettingsName", NAME_SLOT.x, NAME_SLOT.y, NAME_SLOT.width, NAME_SLOT.height, "Name slot", { kind: "name" }).label;
    this.nameBox = createNameBox(root, participantId);
    this.nameEvents = this.nameTrigger();
    this.slotButtons = profileSlots((slot, x, y, width, height) => button(`MeleeSettingsSlot${I2S(slot)}`, x, y, width, height, "", { kind: "slot", slot }, f32(0.011), 37));
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

  private nameTrigger(): trigger {
    const trigger = CreateTrigger();
    BlzTriggerRegisterFrameEvent(trigger, this.nameBox, FRAMEEVENT_EDITBOX_TEXT_CHANGED);
    BlzTriggerRegisterFrameEvent(trigger, this.nameBox, FRAMEEVENT_EDITBOX_ENTER);
    TriggerAddAction(trigger, trampoline(this.nameEvent()));
    this.bindNameEvents();
    return trigger;
  }

  private nameEvent(): string {
    return `ui.settings.${I2S(this.participantId)}.name`;
  }

  private bindNameEvents(): void {
    on(this.nameEvent(), () => {
      if (GetTriggerPlayer() !== Player(this.participantId)) return;
      nameSlot(this.settings, BlzGetTriggerFrameText());
      if (BlzGetTriggerFrameEvent() === FRAMEEVENT_EDITBOX_ENTER) endNaming(this.settings);
    });
  }

  bindActions(actions: SettingsActions): void {
    this.actions = actions;
    this.bindNameEvents();
    bindPrototype(this.clicks, ButtonClicks.prototype);
    this.clicks.bindHandler((button, clicker) => this.click(button, clicker));
  }

  destroy(): void {
    this.clicks.destroy();
    DestroyTrigger(this.nameEvents);
    BlzDestroyFrame(this.root);
  }

  private click(button: SettingsButton, clicker: player): void {
    const { settings } = this;
    if (clicker !== Player(this.participantId) || !settings.ready) return;
    leaveSlotModes(settings, button.kind);
    this.press(button);
  }

  private press(button: SettingsButton): void {
    const { settings } = this;
    if (button.kind === "preset") pickBindingPreset(settings, button.preset);
    else if (button.kind === "customize") customizeLayout(settings);
    else if (button.kind === "profile") loadProfile(settings);
    else if (button.kind === "slot") pickCustomSlot(settings, button.slot);
    else if (button.kind === "name") beginNaming(settings);
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
    endNaming(this.settings);
    this.settings.picking = false;
    this.showNameBox(false);
    BlzFrameSetVisible(this.root, false);
    this.actions.closeSettings(this.participantId);
  }


  update(): void {
    if (!this.local || !this.open) return;
    const { settings } = this;
    const { capture } = settings;
    const signature = `${settings.layout}${encodeBindings(settings.bindings)}${settings.message}${settings.profile}${settings.fromProfile ? "p" : "-"}${settings.picking ? "s" : "-"}${settings.naming ? "n" : "-"}${I2S(settings.slot)}${settings.customs.map(custom => custom.name).join("|")}${capture === undefined ? "-" : I2S(capture.action * 2 + capture.slot)}`;
    if (signature === this.lastSignature) return;
    this.lastSignature = signature;
    BlzFrameSetVisible(this.root, true);
    this.renderHeader(settings);
    this.renderKeys(settings);
  }

  private renderHeader(settings: Readonly<BindingSettings>): void {
    const { capture } = settings;
    const stock = presetOf(settings.bindings);
    this.renderLayouts(settings);
    const unbound = unboundActions(settings.bindings);
    const unboundText = unbound.map(action => ACTION_KEY_LABELS[action]).join(", ");
    BlzFrameSetText(this.hint, unbound.length > 0 ? `${MENU_STYLE.gold}Unbound: ${unboundText}.|r Save to keep these keys.` : settings.fromProfile ? `${MENU_STYLE.gold}Your saved profile is selected.|r` : stock === undefined ? "Your own keys. Save to keep them." : `${MENU_STYLE.gold}${PRESET_HINTS[stock]}|r`);
    BlzFrameSetText(this.help, capture === undefined ? `Click a lit key, then press its new key; its x clears it. Edits go to Custom. ${START_HINT}` : "Press the new key for the flashing action. Delete clears it, Escape cancels.");
    const first = unbound[0];
    for (const frame of this.bindButton.frames) BlzFrameSetVisible(frame, first !== undefined);
    if (first !== undefined) setFrameText(this.bindButton.label, `Bind ${ACTION_KEY_LABELS[first]}`);
    BlzFrameSetText(this.status, settings.message);
  }

  private renderLayouts(settings: Readonly<BindingSettings>): void {
    const selected = settings.fromProfile ? undefined : settings.layout;
    for (const [preset, frame] of this.presets) {
      const name = preset === "custom" ? slotLabel(settings) : PRESET_NAMES[preset];
      setFrameText(frame, preset === selected ? `${MENU_STYLE.gold}${name}|r` : name);
    }
    setFrameText(this.profileButton, settings.fromProfile || settings.picking ? `${MENU_STYLE.gold}Load profile|r` : "Load profile");
    this.slotButtons.forEach(({ frames, label }, slot) => {
      for (const frame of frames) BlzFrameSetVisible(frame, settings.picking);
      const name = slotLabel(settings, slot);
      setFrameText(label, settings.layout === "custom" && slot === settings.slot ? `${MENU_STYLE.gold}${name}|r` : name);
    });
    setFrameText(this.nameButton, settings.naming ? `${MENU_STYLE.gold}Done naming|r` : "Name slot");
    this.showNameBox(settings.naming);
  }

  private showNameBox(naming: boolean): void {
    if (!this.local) return;
    if (naming && !this.nameShown) {
      BlzFrameSetText(this.nameBox, this.settings.customs[this.settings.slot]?.name ?? "");
      BlzFrameSetVisible(this.nameBox, true);
      BlzFrameSetFocus(this.nameBox, true);
      this.nameShown = true;
    } else if (!naming && this.nameShown) {
      BlzFrameSetFocus(this.nameBox, false);
      BlzFrameSetVisible(this.nameBox, false);
      this.nameShown = false;
    }
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
