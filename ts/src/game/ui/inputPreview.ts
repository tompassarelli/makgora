import { f32 } from "wisp/src/sim/f32";
import { formatInt } from "wisp/game/text";
import { type BindingSettings, previewKeyFree } from "./bindingSettings";
import { type HintDevice, padHintRows, hintText } from "./hintLines";
import { PREVIEW_DIVIDERS, PREVIEW_INNER, PREVIEW_PANEL, PREVIEW_ROWS, PREVIEW_ROW_HEIGHT, PREVIEW_TITLE, previewKeyText, previewRowHeld, previewTextFit } from "./keyboardPreview";
import { type PlateRow, previewPanelLeft } from "./plateLayout";
import { createBackdrop, createText, gameUi, placeTopLeft, sizeText } from "./frames";
import { MENU_FONT, MENU_STYLE, PANEL_TEXTURE } from "./hudLayout";
import { destroyFrame, Frame, setFrameAlpha, setFrameEnabled, setFrameFont, setFrameSize, setFrameText, setFrameTextAlignment, setFrameTexture, setFrameVisible, TextAlignment } from "wisp/game/frames";

const PANEL_BOTTOM = f32(0.012);
const PANEL_ALPHA = 214;
const RULE_PX = f32(0.0006);
export const PREVIEW_RULE_TEXTURE = "war3mapImported\\PreviewRule.tga";
export const PREVIEW_ROW_LIT_TEXTURE = "war3mapImported\\PreviewRowLit.tga";
const TITLE_COLOUR = "|cffd8b45a";
const LABEL_COLOUR = "|cffb4bcc6";
const KEY_COLOUR = "|cfff4ead2";
const LIT_COLOUR = "|cff1c1206";

interface RowFrames {
  readonly lit: Frame;
  readonly label: Frame;
  readonly key: Frame;
  keyText: string;
  shownKey: string;
  held: boolean | undefined;
}

/** The slot between the plate groups: a CONTROLS panel of the local player's own keys, each row lit while its key is held; a pad player sees the pad's buttons here instead. */
export class InputPreview {
  private readonly panel: Frame;
  private readonly title: Frame;
  private readonly rules: readonly Frame[];
  private readonly padLabel: Frame;
  private readonly rows: readonly RowFrames[];
  private shown = false;
  private shownDevice: HintDevice | undefined;
  private shownRevision: number | undefined;
  private innerLeft = 0.0;
  private innerTop = 0.0;
  laidFor: boolean | undefined;

  constructor() {
    const parent = gameUi();
    this.panel = createBackdrop("InputPreviewPanel", parent, 893);
    setFrameTexture(this.panel, PANEL_TEXTURE, 0, true);
    setFrameAlpha(this.panel, PANEL_ALPHA);
    setFrameSize(this.panel, PREVIEW_PANEL.width, PREVIEW_PANEL.height);
    setFrameEnabled(this.panel, false);
    setFrameVisible(this.panel, false);
    this.title = this.text("InputPreviewTitle", 0);
    setFrameText(this.title, `${TITLE_COLOUR}${PREVIEW_TITLE}|r`);
    this.rules = [...PREVIEW_DIVIDERS, undefined].map((_divider, index) => {
      const rule = createBackdrop(`InputPreviewRule${formatInt(index)}`, this.panel, 894);
      setFrameTexture(rule, PREVIEW_RULE_TEXTURE, 0, true);
      setFrameEnabled(rule, false);
      return rule;
    });
    this.padLabel = createText("InputPreviewPad", this.panel, 894);
    setFrameSize(this.padLabel, PREVIEW_INNER.width, PREVIEW_INNER.height);
    setFrameFont(this.padLabel, MENU_FONT, f32(0.0074), 1);
    setFrameTextAlignment(this.padLabel, TextAlignment.top, TextAlignment.left);
    setFrameEnabled(this.padLabel, false);
    this.rows = PREVIEW_ROWS.map((placed, index) => {
      const lit = createBackdrop(`InputPreviewLit${formatInt(index)}`, this.panel, 895);
      setFrameTexture(lit, PREVIEW_ROW_LIT_TEXTURE, 0, true);
      setFrameEnabled(lit, false);
      setFrameVisible(lit, false);
      const label = this.text(`InputPreviewLabel${formatInt(index)}`, 896);
      setFrameText(label, `${LABEL_COLOUR}${placed.row.label}|r`);
      return { lit, label, key: this.text(`InputPreviewKey${formatInt(index)}`, 896), keyText: "", shownKey: "", held: undefined };
    });
  }

  private text(name: string, context: number): Frame {
    const frame = createText(name, this.panel, context);
    setFrameTextAlignment(frame, TextAlignment.middle, TextAlignment.left);
    setFrameEnabled(frame, false);
    return frame;
  }

  destroy(): void {
    for (const row of this.rows) {
      destroyFrame(row.key);
      destroyFrame(row.label);
      destroyFrame(row.lit);
    }
    for (const rule of this.rules) destroyFrame(rule);
    destroyFrame(this.padLabel);
    destroyFrame(this.title);
    destroyFrame(this.panel);
  }

  isShown(): boolean {
    return this.shown;
  }

  place(row: PlateRow): void {
    this.laidFor = row.preview;
    if (row.count < 1) return;
    const left = f32(previewPanelLeft(row));
    const top = f32(PANEL_BOTTOM + PREVIEW_PANEL.height);
    this.innerLeft = f32(left + PREVIEW_PANEL.margin);
    this.innerTop = f32(top - PREVIEW_PANEL.margin);
    placeTopLeft(this.panel, left, top);
    placeTopLeft(this.padLabel, this.innerLeft, this.innerTop);
    this.shownRevision = undefined;
  }

  private fit(settings: Readonly<BindingSettings>): void {
    const { size, columns } = previewTextFit(settings.bindings);
    placeTopLeft(this.title, this.innerLeft, this.innerTop);
    sizeText(this.title, size, PREVIEW_INNER.width, PREVIEW_ROW_HEIGHT);
    setFrameTextAlignment(this.title, TextAlignment.middle, TextAlignment.center);
    PREVIEW_DIVIDERS.forEach((divider, index) => {
      const rule = this.rules[index];
      const column = columns[divider.column];
      if (rule === undefined || column === undefined) return;
      placeTopLeft(rule, f32(this.innerLeft + column.x), f32(this.innerTop - divider.y));
      setFrameSize(rule, column.width, RULE_PX);
    });
    const first = columns[0], down = this.rules[PREVIEW_DIVIDERS.length];
    if (first !== undefined && down !== undefined) {
      placeTopLeft(down, f32(this.innerLeft + first.x + first.width + f32(((columns[1]?.x ?? 0.0) - first.x - first.width) / 2)), f32(this.innerTop - PREVIEW_ROW_HEIGHT));
      setFrameSize(down, RULE_PX, f32(PREVIEW_INNER.height - PREVIEW_ROW_HEIGHT));
    }
    PREVIEW_ROWS.forEach((placed, index) => {
      const frames = this.rows[index];
      const column = columns[placed.column];
      if (frames === undefined || column === undefined) return;
      const x = f32(this.innerLeft + column.x), y = f32(this.innerTop - placed.y);
      placeTopLeft(frames.lit, x, y);
      setFrameSize(frames.lit, column.width, PREVIEW_ROW_HEIGHT);
      placeTopLeft(frames.label, x, y);
      sizeText(frames.label, size, column.tab, PREVIEW_ROW_HEIGHT);
      placeTopLeft(frames.key, f32(x + column.tab), y);
      sizeText(frames.key, size, f32(column.width - column.tab), PREVIEW_ROW_HEIGHT);
      frames.keyText = previewKeyText(settings.bindings, placed.row);
      frames.shownKey = "";
      frames.held = undefined;
    });
  }

  update(visible: boolean, settings: Readonly<BindingSettings>, device: HintDevice, down: (this: void, key: number) => boolean): void {
    if (visible !== this.shown) {
      this.shown = visible;
      setFrameVisible(this.panel, visible);
    }
    if (!visible) return;
    if (device !== this.shownDevice) {
      this.shownDevice = device;
      this.shownRevision = undefined;
      const keyboard = device === "keyboard";
      setFrameVisible(this.padLabel, !keyboard);
      for (const frame of [this.title, ...this.rules]) setFrameVisible(frame, keyboard);
      for (const row of this.rows) {
        setFrameVisible(row.label, keyboard);
        setFrameVisible(row.key, keyboard);
        if (!keyboard) setFrameVisible(row.lit, false);
        row.held = undefined;
      }
    }
    if (device === "pad") {
      if (settings.revision === this.shownRevision) return;
      this.shownRevision = settings.revision;
      setFrameText(this.padLabel, hintText(padHintRows(previewKeyFree(settings)), MENU_STYLE.gold));
      return;
    }
    if (settings.revision !== this.shownRevision) {
      this.shownRevision = settings.revision;
      this.fit(settings);
    }
    for (let index = 0; index < PREVIEW_ROWS.length; index++) {
      const placed = PREVIEW_ROWS[index], frames = this.rows[index];
      if (placed === undefined || frames === undefined) continue;
      const held = previewRowHeld(settings.bindings, placed.row, down);
      const key = frames.keyText;
      if (held === frames.held && key === frames.shownKey) continue;
      frames.held = held;
      frames.shownKey = key;
      setFrameVisible(frames.lit, held);
      setFrameText(frames.label, `${held ? LIT_COLOUR : LABEL_COLOUR}${placed.row.label}|r`);
      setFrameText(frames.key, `${held ? LIT_COLOUR : KEY_COLOUR}${key}|r`);
    }
  }
}
