import { on, trampoline } from "wisp/src/platform/dispatch";
import { f32 } from "wisp/src/sim/f32";
import { bindPrototype } from "../../platform/rebind";
import { ACTION_KEY_LABELS, BINDING_PRESETS, type BindingPreset, PRESET_NAMES, actionFor, encodeBindings, keyLabel, unboundActions } from "../input/keyBindings";
import { CUSTOM_SLOT_COUNT, SLOT_NAME_LIMIT, customSlotEmpty } from "../input/layoutSave";
import {
  type BindingSettings,
  beginKeyCapture,
  beginNaming,
  bindFirstUnbound,
  cancelBindingCapture,
  clearKey,
  closeSlotMenu,
  customButtonLabel,
  deleteProfile,
  endNaming,
  nameSlot,
  pickBindingPreset,
  pickCustomSlot,
  pressCustomButton,
  previewStartingBindings,
  resetToLayout,
  saveBindingSettings,
  slotLabel,
  toggleKeyboardPreview,
} from "./bindingSettings";
import { ButtonClicks, createBackdrop, createText, frameMenuPanel, gameUi, placeTopLeft, setMenuText } from "./frames";
import { MENU_FONT, MENU_STYLE } from "./hudLayout";
import { KEY_CAP_HEIGHT, keyboardCaps } from "./keyboardLayout";
import { PREVIEW_ROW_LIT_TEXTURE } from "./inputPreview";
import { createEvents, destroyEvents, Events, onEvents } from "wisp/game/events";
import { addFrameEvent, createFrame, createFrameByType, destroyFrame, eventFrameEvent, eventFrameText, Frame, FrameEvent, FramePoint, setFrameAlpha, setFrameEnabled, setFrameFocus, setFrameFont, setFrameLevel, setFramePoint, setFrameSize, setFrameText, setFrameTextAlignment, setFrameTextLimit, setFrameTexture, setFrameVisible, TextAlignment } from "wisp/game/frames";
import { eventPlayer, localPlayer, Player, player as playerOf } from "wisp/game/players";
import { formatInt } from "wisp/game/text";

export interface SettingsActions {
  closeSettings(participantId: number): void;
}

type SettingsButton = { kind: "preset"; preset: BindingPreset } | { kind: "custom" } | { kind: "slot"; slot: number } | { kind: "dismiss" } | { kind: "name" } | { kind: "delete" } | { kind: "save" } | { kind: "close" } | { kind: "key"; key: number } | { kind: "clear"; key: number } | { kind: "reset" } | { kind: "bindUnbound" } | { kind: "keyboard" };

interface KeyButton {
  readonly key: number;
  readonly frame: Frame;
  readonly action: Frame;
  readonly clear: readonly Frame[];
}

interface PanelButton {
  readonly art: Frame;
  readonly label: Frame;
}

// MENU_STYLE.panelTexture draws a silver rail at 18-20% and 92-93% of its height: the top row sits above the first and the bottom row below the second.
const PANEL = { x: f32(0.065), top: f32(0.545), width: f32(0.67), height: f32(0.49) } as const;
const below = (offset: number): number => f32(PANEL.top - f32(offset));
const LEFT = f32(0.09);
const RIGHT = f32(0.711);
const ROW_Y = below(f32(0.045));
const ROW_HEIGHT = f32(0.032);
const PRESET_STEP = f32(0.122);
const PRESET_WIDTH = f32(0.118);
const EDIT_STEP = f32(0.079);
const EDIT_WIDTH = f32(0.075);
const SLOT_HEIGHT = f32(0.03);
const BOTTOM_Y = below(f32(0.448));
const BOTTOM_HEIGHT = f32(0.027);
const BOTTOM_WIDTH = f32(0.105);
export const presetButton = (index: number) => ({ x: f32(LEFT + f32(index * PRESET_STEP)), y: ROW_Y, width: PRESET_WIDTH, height: ROW_HEIGHT });
export const CUSTOM_BUTTON = presetButton(BINDING_PRESETS.indexOf("custom"));
export const editButton = (index: number) => ({ x: f32(f32(RIGHT - EDIT_WIDTH) - f32((2 - index) * EDIT_STEP)), y: ROW_Y, width: EDIT_WIDTH, height: ROW_HEIGHT });
export const slotOption = (slot: number) => ({ x: CUSTOM_BUTTON.x, y: f32(f32(CUSTOM_BUTTON.y - CUSTOM_BUTTON.height) - f32(slot * SLOT_HEIGHT)), width: CUSTOM_BUTTON.width, height: SLOT_HEIGHT });
export const PICKER_DONE = { x: f32(RIGHT - BOTTOM_WIDTH), y: BOTTOM_Y, width: BOTTOM_WIDTH, height: BOTTOM_HEIGHT } as const;
const SAVE_BUTTON = { x: f32(f32(PICKER_DONE.x - BOTTOM_WIDTH) - f32(0.004)), y: BOTTOM_Y, width: BOTTOM_WIDTH, height: BOTTOM_HEIGHT } as const;
export const KEYBOARD_BUTTON = { x: LEFT, y: BOTTOM_Y, width: f32(0.22), height: BOTTOM_HEIGHT } as const;
const BIND_BUTTON = { x: f32(RIGHT - f32(0.15)), y: below(f32(0.107)), width: f32(0.15), height: f32(0.022) } as const;
const DIM_KEY = 105;
const LIT_KEY = 255;
const CLEAR_SIZE = f32(0.012);
const DARK = "|cff22180a";
const MUTED = "|cff8a96a3";
const HINT = "|cffffffffClick a lit key to rebind, or click its red |r|cffff6060x|r|cffffffff to clear.|r";
const CAPTURE_HINT = "Press the new key for the flashing action. Delete clears it, Escape cancels.";

function createNameBox(root: Frame, participantId: number): Frame {
  const box = createFrameByType("EDITBOX", `MeleeSettingsNameBox${formatInt(participantId)}`, root, "EscMenuEditBoxTemplate", participantId);
  placeTopLeft(box, CUSTOM_BUTTON.x, CUSTOM_BUTTON.y);
  setFrameSize(box, CUSTOM_BUTTON.width, CUSTOM_BUTTON.height);
  setFrameTextLimit(box, SLOT_NAME_LIMIT);
  setFrameLevel(box, 35);
  setFrameVisible(box, false);
  return box;
}

function leaveSlotModes(settings: BindingSettings, kind: SettingsButton["kind"]): void {
  if (kind !== "name") endNaming(settings);
  if (kind !== "custom" && kind !== "slot") closeSlotMenu(settings);
}

export class SettingsPanel {
  readonly root: Frame;
  private readonly hint: Frame;
  private readonly help: Frame;
  private readonly status: Frame;
  private readonly presets: readonly (readonly [BindingPreset, Frame])[];
  private readonly custom: PanelButton;
  private readonly customLit: Frame;
  private readonly keys: readonly KeyButton[];
  private readonly clicks: ButtonClicks<SettingsButton>;
  private readonly slotButtons: readonly PanelButton[];
  private readonly dismiss: Frame;
  private readonly edits: readonly (readonly [PanelButton, string])[];
  private readonly nameBox: Frame;
  private readonly nameEvents: Events;
  private readonly keyboardButton: Frame;
  private readonly bindButton: PanelButton;
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
    frameMenuPanel(root, `MeleeSettingsRoot${suffix}`, participantId, 30);
    placeTopLeft(root, PANEL.x, PANEL.top);
    setFrameSize(root, PANEL.width, PANEL.height);
    setFrameLevel(root, 30);
    this.root = root;
    const text = (name: string, parent: Frame, size: number, width: number, height: number, level = parent === root ? 31 : 32): Frame => {
      const frame = createText(`${name}${suffix}`, parent, participantId);
      setFrameSize(frame, width, height);
      setFrameFont(frame, MENU_FONT, size, 0);
      setFrameEnabled(frame, false);
      setFrameLevel(frame, level);
      return frame;
    };
    const line = (name: string, x: number, y: number, width: number, height: number, size = f32(0.011)): Frame => {
      const frame = text(name, root, size, width, height);
      placeTopLeft(frame, x, y);
      return frame;
    };
    const button = (name: string, box: { readonly x: number; readonly y: number; readonly width: number; readonly height: number }, caption: string, target: SettingsButton, level = 31, labelLevel = level + 1): PanelButton => {
      const { x, y, width, height } = box;
      const art = createFrame("ScriptDialogButton", root, 0, participantId);
      placeTopLeft(art, x, y);
      setFrameSize(art, width, height);
      setFrameLevel(art, level);
      const label = text(name, art, f32(0.011), width, height, labelLevel);
      setFramePoint(label, FramePoint.center, art, FramePoint.center, 0.0, 0.0);
      setFrameTextAlignment(label, TextAlignment.middle, TextAlignment.center);
      setMenuText(label, caption);
      this.clicks.add(art, target, undefined, "native", { x, y, width, height });
      return { art, label };
    };
    setFrameText(line("MeleeSettingsTitle", LEFT, below(f32(0.017)), f32(0.3), f32(0.024), f32(0.013)), `${MENU_STYLE.gold}CONTROLS|r`);
    this.presets = BINDING_PRESETS.filter(preset => preset !== "custom").map((preset, index): readonly [BindingPreset, Frame] => [preset, button(`MeleeSettingsPreset${formatInt(index)}`, presetButton(index), PRESET_NAMES[preset], { kind: "preset", preset }).label]);
    this.custom = button("MeleeSettingsCustom", CUSTOM_BUTTON, "", { kind: "custom" }, 31, 33);
    this.customLit = createBackdrop(`MeleeSettingsCustomLit${suffix}`, this.custom.art, participantId);
    setFrameTexture(this.customLit, PREVIEW_ROW_LIT_TEXTURE, 0, true);
    setFramePoint(this.customLit, FramePoint.topLeft, this.custom.art, FramePoint.topLeft, f32(0.004), f32(-0.004));
    setFramePoint(this.customLit, FramePoint.bottomRight, this.custom.art, FramePoint.bottomRight, f32(-0.004), f32(0.004));
    setFrameEnabled(this.customLit, false);
    setFrameLevel(this.customLit, 32);
    this.edits = [
      [button("MeleeSettingsName", editButton(0), "Rename", { kind: "name" }), "Rename"],
      [button("MeleeSettingsReset", editButton(1), "Reset", { kind: "reset" }), "Reset"],
      [button("MeleeSettingsDelete", editButton(2), "Delete", { kind: "delete" }), "Delete"],
    ];
    this.nameBox = createNameBox(root, participantId);
    this.nameEvents = this.nameTrigger();
    this.hint = line("MeleeSettingsHint", LEFT, below(f32(0.108)), f32(0.45), f32(0.016), f32(0.0105));
    this.help = line("MeleeSettingsHelp", f32(RIGHT - f32(0.2)), below(f32(0.108)), f32(0.2), f32(0.016), f32(0.0095));
    setFrameTextAlignment(this.help, TextAlignment.middle, TextAlignment.right);
    setFrameText(this.help, `${MUTED}F1 - F9 for help.|r`);
    this.keys = keyboardCaps(LEFT, below(f32(0.135))).map(({ key, x, y, width }): KeyButton => {
      const { art } = button(`MeleeSettingsKey${formatInt(key)}`, { x, y, width, height: KEY_CAP_HEIGHT }, "", { kind: "key", key });
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
    this.status = line("MeleeSettingsStatus", LEFT, below(f32(0.375)), f32(0.6), f32(0.016));
    this.keyboardButton = button("MeleeSettingsKeyboard", KEYBOARD_BUTTON, "", { kind: "keyboard" }).label;
    button("MeleeSettingsSave", SAVE_BUTTON, "Save", { kind: "save" });
    button("MeleeSettingsClose", PICKER_DONE, "Done", { kind: "close" });
    this.bindButton = button("MeleeSettingsBind", BIND_BUTTON, "", { kind: "bindUnbound" });
    this.dismiss = createFrameByType("BUTTON", `MeleeSettingsDismiss${suffix}`, root, "", participantId);
    setFramePoint(this.dismiss, FramePoint.topLeft, root, FramePoint.topLeft, 0.0, 0.0);
    setFramePoint(this.dismiss, FramePoint.bottomRight, root, FramePoint.bottomRight, 0.0, 0.0);
    setFrameLevel(this.dismiss, 36);
    setFrameVisible(this.dismiss, false);
    this.clicks.add(this.dismiss, { kind: "dismiss" }, undefined, "native");
    const slotButtons: PanelButton[] = [];
    for (let slot = 0; slot < CUSTOM_SLOT_COUNT; slot++) slotButtons.push(button(`MeleeSettingsSlot${formatInt(slot)}`, slotOption(slot), "", { kind: "slot", slot }, 37));
    this.slotButtons = slotButtons;
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
    else if (button.kind === "custom") pressCustomButton(settings);
    else if (button.kind === "dismiss") return;
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
    const signature = `${settings.keyboard ? "k" : "-"}${settings.layout}${encodeBindings(settings.bindings)}${settings.message}${settings.profile}${settings.dirty ? "d" : "-"}${settings.picking ? "s" : "-"}${settings.naming ? "n" : "-"}${formatInt(settings.slot)}${settings.customs.map(custom => custom.name).join("|")}${capture === undefined ? "-" : formatInt(capture.action * 2 + capture.slot)}`;
    if (signature === this.lastSignature) return;
    this.lastSignature = signature;
    this.showRoot(true);
    this.renderHeader(settings);
    this.renderKeys(settings);
  }

  private renderHeader(settings: Readonly<BindingSettings>): void {
    this.renderLayouts(settings);
    setMenuText(this.keyboardButton, `Show keyboard in game: ${settings.keyboard ? `${MENU_STYLE.gold}On|r` : "Off"}`);
    setFrameText(this.hint, settings.capture === undefined ? HINT : `${MENU_STYLE.gold}${CAPTURE_HINT}|r`);
    const first = unboundActions(settings.bindings)[0];
    setFrameVisible(this.bindButton.art, first !== undefined);
    setFrameVisible(this.help, first === undefined);
    if (first !== undefined) setMenuText(this.bindButton.label, `Bind ${ACTION_KEY_LABELS[first]}`);
    setFrameText(this.status, settings.message);
  }

  private renderLayouts(settings: Readonly<BindingSettings>): void {
    for (const [preset, frame] of this.presets) setMenuText(frame, preset === settings.layout ? `${MENU_STYLE.gold}${PRESET_NAMES[preset]}|r` : PRESET_NAMES[preset]);
    const custom = settings.layout === "custom";
    const name = customButtonLabel(settings);
    setFrameVisible(this.customLit, custom);
    setMenuText(this.custom.label, custom ? `${DARK}${name}|r` : name);
    setFrameVisible(this.dismiss, settings.picking);
    this.slotButtons.forEach(({ art, label }, slot) => {
      setFrameVisible(art, settings.picking);
      const name = customSlotEmpty(settings.customs, slot) ? `${slotLabel(settings, slot)} ${MUTED}(empty)|r` : slotLabel(settings, slot);
      setMenuText(label, slot === settings.slot ? `${MENU_STYLE.gold}${name}|r` : name);
    });
    for (const [{ art, label }, caption] of this.edits) {
      setFrameAlpha(art, custom ? LIT_KEY : DIM_KEY);
      setFrameEnabled(art, custom);
      setMenuText(label, !custom ? `${MUTED}${caption}|r` : caption === "Rename" && settings.naming ? `${MENU_STYLE.gold}Done|r` : caption);
    }
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
