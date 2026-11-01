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
  deleteProfile,
  endNaming,
  loadProfile,
  nameSlot,
  pickBindingPreset,
  pickCustomSlot,
  previewStartingBindings,
  resetToLayout,
  saveBindingSettings,
  slotLabel,
  toggleKeyboardPreview,
} from "./bindingSettings";
import { ButtonClicks, createBackdrop, createText, gameUi, placeTopLeft, setMenuText, styleMenuPanel } from "./frames";
import { MENU_FONT, MENU_STYLE } from "./hudLayout";
import { KEY_CAP_HEIGHT, keyboardCaps } from "./keyboardLayout";
import { START_HINT } from "./helpText";
import { createEvents, destroyEvents, Events, onEvents } from "wisp/game/events";
import { addFrameEvent, createFrameByType, destroyFrame, eventFrameEvent, eventFrameText, Frame, FrameEvent, FramePoint, setFrameAlpha, setFrameEnabled, setFrameFocus, setFrameFont, setFrameLevel, setFramePoint, setFrameSize, setFrameText, setFrameTextAlignment, setFrameTextLimit, setFrameTexture, setFrameVisible, TextAlignment } from "wisp/game/frames";
import { eventPlayer, localPlayer, Player, player as playerOf } from "wisp/game/players";
import { formatInt } from "wisp/game/text";

export interface SettingsActions {
  closeSettings(participantId: number): void;
}

type SettingsButton = { kind: "preset"; preset: BindingPreset } | { kind: "customize" } | { kind: "profile" } | { kind: "slot"; slot: number } | { kind: "name" } | { kind: "delete" } | { kind: "save" } | { kind: "close" } | { kind: "key"; key: number } | { kind: "clear"; key: number } | { kind: "reset" } | { kind: "bindUnbound" } | { kind: "keyboard" };

interface KeyButton {
  readonly key: number;
  readonly frame: Frame;
  readonly action: Frame;
  readonly clear: readonly Frame[];
}

export const PICKER_DONE = { x: f32(0.23), y: f32(0.155), width: f32(0.105), height: f32(0.032) } as const;
const BUTTON_TEXTURE = "war3mapImported\\SelectionAction.tga";
const PRESET_STEP = f32(0.122);
const PRESET_WIDTH = f32(0.118);
export const presetButton = (index: number) => ({ x: f32(0.12) + index * PRESET_STEP, y: f32(0.548), width: PRESET_WIDTH, height: f32(0.034) });
const CUSTOMIZE = presetButton(BINDING_PRESETS.length);
export const LOAD_PROFILE = presetButton(BINDING_PRESETS.length + 1);
export const profileSlotButton = (slot: number) => ({ x: LOAD_PROFILE.x, y: [f32(0.512), f32(0.476), f32(0.44)][slot] ?? LOAD_PROFILE.y, width: LOAD_PROFILE.width, height: f32(0.034) });
export const DELETE_PROFILE = { x: LOAD_PROFILE.x, y: f32(0.584), width: LOAD_PROFILE.width, height: f32(0.03) } as const;
export const NAME_BOX = { x: f32(0.39), y: f32(0.585), width: f32(0.21), height: f32(0.032) } as const;
export const KEYBOARD_BUTTON = { x: f32(0.12), y: f32(0.192), width: f32(0.22), height: f32(0.028) } as const;
const DIM_KEY = 105;
const LIT_KEY = 255;
const CLEAR_SIZE = f32(0.012);

type SlotButton = { readonly frames: readonly Frame[]; readonly label: Frame };

function createNameBox(root: Frame, participantId: number): Frame {
  const box = createFrameByType("EDITBOX", `MeleeSettingsNameBox${formatInt(participantId)}`, root, "EscMenuEditBoxTemplate", participantId);
  placeTopLeft(box, NAME_BOX.x, NAME_BOX.y);
  setFrameSize(box, NAME_BOX.width, NAME_BOX.height);
  setFrameTextLimit(box, SLOT_NAME_LIMIT);
  setFrameLevel(box, 33);
  setFrameVisible(box, false);
  return box;
}

function profileSlots(button: (slot: number, x: number, y: number, width: number, height: number) => { readonly art: Frame; readonly label: Frame; readonly hotspot: Frame }): readonly SlotButton[] {
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
  readonly root: Frame;
  private readonly hint: Frame;
  private readonly help: Frame;
  private readonly status: Frame;
  private readonly presets: readonly (readonly [BindingPreset, Frame])[];
  private readonly keys: readonly KeyButton[];
  private readonly clicks: ButtonClicks<SettingsButton>;
  private readonly profileButton: Frame;
  private readonly slotButtons: readonly SlotButton[];
  private readonly nameButton: Frame;
  private readonly customOnly: readonly Frame[];
  private readonly nameBox: Frame;
  private readonly nameEvents: Events;
  private readonly keyboardButton: Frame;
  private readonly bindButton: { readonly frames: readonly Frame[]; readonly label: Frame };
  private open = false;
  private rootShown = false;
  private nameShown = false;
  private lastSignature = "";
  private readonly local: boolean;

  constructor(
    private readonly settings: BindingSettings,
    private actions: SettingsActions,
    readonly participantId: number,
  ) {
    const suffix = formatInt(participantId);
    this.local = localPlayer() === playerOf(participantId);
    this.clicks = new ButtonClicks(`ui.settings.${suffix}.click`, (button, clicker) => this.click(button, clicker));
    const root = createBackdrop(`MeleeSettingsRoot${suffix}`, gameUi(), participantId);
    setFrameLevel(styleMenuPanel(root, `MeleeSettingsRoot${suffix}`), 30);
    placeTopLeft(root, f32(0.09), f32(0.595));
    setFrameSize(root, f32(0.66), f32(0.53));
    setFrameLevel(root, 30);
    this.root = root;
    const text = (name: string, parent: Frame, size: number, width: number, height: number): Frame => {
      const frame = createText(`${name}${suffix}`, parent, participantId);
      setFrameSize(frame, width, height);
      setFrameFont(frame, MENU_FONT, size, 0);
      setFrameEnabled(frame, false);
      setFrameLevel(frame, parent === root ? 31 : 32);
      return frame;
    };
    const line = (name: string, x: number, y: number, width: number, height: number, size = f32(0.011)): Frame => {
      const frame = text(name, root, size, width, height);
      placeTopLeft(frame, x, y);
      return frame;
    };
    const button = (name: string, x: number, y: number, width: number, height: number, caption: string, target: SettingsButton, size = f32(0.011), level = 31): { readonly art: Frame; readonly label: Frame; readonly hotspot: Frame } => {
      const art = createBackdrop(`${name}Art${suffix}`, root, participantId);
      setFrameTexture(art, BUTTON_TEXTURE, 0, true);
      placeTopLeft(art, x, y);
      setFrameSize(art, width, height);
      setFrameEnabled(art, false);
      setFrameLevel(art, level);
      const label = text(name, art, size, width, height);
      setFramePoint(label, FramePoint.center, art, FramePoint.center, 0.0, 0.0);
      setFrameTextAlignment(label, TextAlignment.middle, TextAlignment.center);
      setMenuText(label, caption);
      const hotspot = createFrameByType("BUTTON", `${name}Hit${suffix}`, root, "", participantId);
      placeTopLeft(hotspot, x, y);
      setFrameSize(hotspot, width, height);
      setFrameLevel(hotspot, level + 2);
      this.clicks.add(hotspot, target, undefined, "native", { x, y, width, height });
      return { art, label, hotspot };
    };
    setFrameText(line("MeleeSettingsTitle", f32(0.12), f32(0.578), f32(0.3), f32(0.026), f32(0.016)), `${MENU_STYLE.gold}CONTROLS|r`);
    this.presets = BINDING_PRESETS.map((preset, index): readonly [BindingPreset, Frame] => {
      const { x, y, width, height } = presetButton(index);
      return [preset, button(`MeleeSettingsPreset${formatInt(index)}`, x, y, width, height, PRESET_NAMES[preset], { kind: "preset", preset }).label];
    });
    button("MeleeSettingsCustomize", CUSTOMIZE.x, CUSTOMIZE.y, CUSTOMIZE.width, CUSTOMIZE.height, "Customize", { kind: "customize" });
    this.profileButton = button("MeleeSettingsProfile", LOAD_PROFILE.x, LOAD_PROFILE.y, LOAD_PROFILE.width, LOAD_PROFILE.height, "Load profile", { kind: "profile" }).label;
    const remove = button("MeleeSettingsDelete", DELETE_PROFILE.x, DELETE_PROFILE.y, DELETE_PROFILE.width, DELETE_PROFILE.height, "Delete profile", { kind: "delete" });
    this.keyboardButton = button("MeleeSettingsKeyboard", KEYBOARD_BUTTON.x, KEYBOARD_BUTTON.y, KEYBOARD_BUTTON.width, KEYBOARD_BUTTON.height, "", { kind: "keyboard" }).label;
    this.nameBox = createNameBox(root, participantId);
    this.nameEvents = this.nameTrigger();
    this.slotButtons = profileSlots((slot, x, y, width, height) => button(`MeleeSettingsSlot${formatInt(slot)}`, x, y, width, height, "", { kind: "slot", slot }, f32(0.011), 37));
    this.hint = line("MeleeSettingsHint", f32(0.12), f32(0.51), f32(0.6), f32(0.018));
    this.help = line("MeleeSettingsHelp", f32(0.12), f32(0.4815), f32(0.6), f32(0.014), f32(0.0095));
    this.keys = keyboardCaps(f32(0.12), f32(0.465)).map(({ key, x, y, width }): KeyButton => {
      const { art } = button(`MeleeSettingsKey${formatInt(key)}`, x, y, width, KEY_CAP_HEIGHT, "", { kind: "key", key });
      const clear = this.clearCross(root, key, f32(f32(x + width) - CLEAR_SIZE), y);
      const name = text(`MeleeSettingsKeyName${formatInt(key)}`, art, f32(0.011), width, f32(0.016));
      setFramePoint(name, FramePoint.top, art, FramePoint.top, 0.0, f32(-0.007));
      setFrameTextAlignment(name, TextAlignment.middle, TextAlignment.center);
      setFrameText(name, keyLabel(key));
      const action = text(`MeleeSettingsKeyAction${formatInt(key)}`, art, f32(0.0075), width, f32(0.013));
      setFramePoint(action, FramePoint.bottom, art, FramePoint.bottom, 0.0, f32(0.007));
      setFrameTextAlignment(action, TextAlignment.middle, TextAlignment.center);
      return { key, frame: art, action, clear };
    });
    this.status = line("MeleeSettingsStatus", f32(0.12), f32(0.218), f32(0.6), f32(0.018));
    button("MeleeSettingsSave", f32(0.12), f32(0.155), f32(0.105), f32(0.032), "Save", { kind: "save" }); button("MeleeSettingsClose", PICKER_DONE.x, PICKER_DONE.y, PICKER_DONE.width, PICKER_DONE.height, "Done", { kind: "close" });
    const rename = button("MeleeSettingsName", f32(0.34), f32(0.155), f32(0.105), f32(0.032), "Rename", { kind: "name" }), reset = button("MeleeSettingsReset", f32(0.45), f32(0.155), f32(0.105), f32(0.032), "Reset", { kind: "reset" });
    this.nameButton = rename.label;
    this.customOnly = [remove.art, remove.label, remove.hotspot, rename.art, rename.label, rename.hotspot, reset.art, reset.label, reset.hotspot];
    const bind = button("MeleeSettingsBind", f32(0.56), f32(0.155), f32(0.17), f32(0.032), "", { kind: "bindUnbound" });
    this.bindButton = { frames: [bind.art, bind.hotspot], label: bind.label };
    setFrameVisible(root, false);
  }

  over(x: number, y: number): boolean {
    return this.open && this.clicks.over(x, y);
  }

  private clearCross(root: Frame, key: number, x: number, y: number): readonly Frame[] {
    const cross = createText(`MeleeSettingsKeyClear${formatInt(key)}${formatInt(this.participantId)}`, root, this.participantId);
    setFrameSize(cross, CLEAR_SIZE, CLEAR_SIZE);
    setFrameFont(cross, MENU_FONT, f32(0.009), 0);
    setFrameEnabled(cross, false);
    placeTopLeft(cross, x, y);
    setFrameLevel(cross, 34);
    setFrameTextAlignment(cross, TextAlignment.middle, TextAlignment.center);
    setFrameText(cross, "|cffff6060x|r");
    const hit = createFrameByType("BUTTON", `MeleeSettingsKeyClearHit${formatInt(key)}`, root, "", this.participantId);
    placeTopLeft(hit, x, y);
    setFrameSize(hit, CLEAR_SIZE, CLEAR_SIZE);
    setFrameLevel(hit, 35);
    this.clicks.add(hit, { kind: "clear", key }, undefined, "native", { x, y, width: CLEAR_SIZE, height: CLEAR_SIZE });
    return [cross, hit];
  }

  private nameTrigger(): Events {
    const trigger = createEvents();
    addFrameEvent(trigger, this.nameBox, FrameEvent.editboxTextChanged);
    addFrameEvent(trigger, this.nameBox, FrameEvent.editboxEnter);
    onEvents(trigger, trampoline(this.nameEvent()));
    this.bindNameEvents();
    return trigger;
  }

  private nameEvent(): string {
    return `ui.settings.${formatInt(this.participantId)}.name`;
  }

  private bindNameEvents(): void {
    on(this.nameEvent(), () => {
      if (eventPlayer() !== playerOf(this.participantId)) return;
      nameSlot(this.settings, eventFrameText());
      if (eventFrameEvent() === FrameEvent.editboxEnter) endNaming(this.settings);
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
    destroyEvents(this.nameEvents);
    destroyFrame(this.root);
  }

  private click(button: SettingsButton, clicker: Player): void {
    const { settings } = this;
    if (clicker !== playerOf(this.participantId) || !settings.ready) return;
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
    else if (button.kind === "delete") deleteProfile(settings);
    else if (button.kind === "save") saveBindingSettings(settings);
    else if (button.kind === "close") this.close();
    else if (button.kind === "clear") clearKey(settings, button.key);
    else if (button.kind === "reset") resetToLayout(settings);
    else if (button.kind === "bindUnbound") bindFirstUnbound(settings);
    else if (button.kind === "keyboard") toggleKeyboardPreview(settings);
    else beginKeyCapture(settings, button.key);
  }

  isOpen(): boolean {
    return this.open;
  }

  /** Whether the Controls panel is up on this client's screen, open or previewed while the controls load. */
  covers(): boolean {
    return this.rootShown;
  }

  private showRoot(visible: boolean): void {
    this.rootShown = visible;
    setFrameVisible(this.root, visible);
  }


  preview(): void {
    if (this.open || this.settings.ready) return;
    const preview = previewStartingBindings(this.settings);
    if (preview === undefined) return;
    this.showRoot(true);
    this.renderHeader(preview);
    this.renderKeys(preview);
  }

  endPreview(): void {
    if (!this.open) this.showRoot(false);
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
    this.showRoot(false);
    this.actions.closeSettings(this.participantId);
  }


  update(): void {
    if (!this.local || !this.open) return;
    const { settings } = this;
    const { capture } = settings;
    const signature = `${settings.keyboard ? "k" : "-"}${settings.layout}${encodeBindings(settings.bindings)}${settings.message}${settings.profile}${settings.fromProfile ? "p" : "-"}${settings.picking ? "s" : "-"}${settings.naming ? "n" : "-"}${formatInt(settings.slot)}${settings.customs.map(custom => custom.name).join("|")}${capture === undefined ? "-" : formatInt(capture.action * 2 + capture.slot)}`;
    if (signature === this.lastSignature) return;
    this.lastSignature = signature;
    this.showRoot(true);
    this.renderHeader(settings);
    this.renderKeys(settings);
  }

  private renderHeader(settings: Readonly<BindingSettings>): void {
    const { capture } = settings;
    const stock = presetOf(settings.bindings);
    this.renderLayouts(settings);
    setMenuText(this.keyboardButton, `Show keyboard in game: ${settings.keyboard ? `${MENU_STYLE.gold}On|r` : "Off"}`);
    const unbound = unboundActions(settings.bindings);
    const unboundText = unbound.map(action => ACTION_KEY_LABELS[action]).join(", ");
    setFrameText(this.hint, unbound.length > 0 ? `${MENU_STYLE.gold}Unbound: ${unboundText}.|r Save to keep these keys.` : settings.fromProfile ? `${MENU_STYLE.gold}Your saved profile is selected.|r` : stock === undefined ? "Your own keys. Save to keep them." : `${MENU_STYLE.gold}${PRESET_HINTS[stock]}|r`);
    setFrameText(this.help, capture === undefined ? `Click a lit key, then press its new key; its x clears it. Edits go to Custom. ${START_HINT}` : "Press the new key for the flashing action. Delete clears it, Escape cancels.");
    const first = unbound[0];
    for (const frame of this.bindButton.frames) setFrameVisible(frame, first !== undefined);
    if (first !== undefined) setMenuText(this.bindButton.label, `Bind ${ACTION_KEY_LABELS[first]}`);
    setFrameText(this.status, settings.message);
  }

  private renderLayouts(settings: Readonly<BindingSettings>): void {
    const selected = settings.fromProfile ? undefined : settings.layout;
    for (const [preset, frame] of this.presets) {
      const name = preset === "custom" ? slotLabel(settings) : PRESET_NAMES[preset];
      setMenuText(frame, preset === selected ? `${MENU_STYLE.gold}${name}|r` : name);
    }
    setMenuText(this.profileButton, settings.fromProfile || settings.picking ? `${MENU_STYLE.gold}Load profile|r` : "Load profile");
    this.slotButtons.forEach(({ frames, label }, slot) => {
      for (const frame of frames) setFrameVisible(frame, settings.picking);
      const name = slotLabel(settings, slot);
      setMenuText(label, settings.layout === "custom" && slot === settings.slot ? `${MENU_STYLE.gold}${name}|r` : name);
    });
    for (const frame of this.customOnly) setFrameVisible(frame, settings.layout === "custom");
    setMenuText(this.nameButton, settings.naming ? `${MENU_STYLE.gold}Done naming|r` : "Rename");
    this.showNameBox(settings.naming);
  }

  private showNameBox(naming: boolean): void {
    if (!this.local) return;
    if (naming && !this.nameShown) {
      setFrameText(this.nameBox, this.settings.customs[this.settings.slot]?.name ?? "");
      setFrameVisible(this.nameBox, true);
      setFrameFocus(this.nameBox, true);
      this.nameShown = true;
    } else if (!naming && this.nameShown) {
      setFrameFocus(this.nameBox, false);
      setFrameVisible(this.nameBox, false);
      this.nameShown = false;
    }
  }

  private renderKeys(settings: Readonly<BindingSettings>): void {
    const { capture } = settings;
    for (const { key, frame, action, clear } of this.keys) {
      const bound = actionFor(settings.bindings, key);
      const index = settings.bindings.keys.indexOf(key);
      const capturing = capture !== undefined && index === capture.action * 2 + capture.slot;
      setFrameAlpha(frame, bound === undefined ? DIM_KEY : LIT_KEY);
      for (const part of clear) setFrameVisible(part, bound !== undefined);
      setFrameText(action, bound === undefined ? "" : capturing ? "|cff66ff66press...|r" : `${MENU_STYLE.gold}${ACTION_KEY_LABELS[bound]}|r`);
    }
  }
}
