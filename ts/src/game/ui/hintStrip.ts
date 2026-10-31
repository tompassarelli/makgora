import { f32 } from "wisp/src/sim/f32";
import { type BindingSettings, hintsKeyFree } from "./bindingSettings";
import { type HintDevice, hintRows, hintText } from "./hintLines";
import { HINT_STRIP_CELL, hintStripLeft } from "./plateLayout";
import { createBackdrop, createText, gameUi, placeTopLeft } from "./frames";
import { MENU_FONT, MENU_STYLE, PANEL_TEXTURE } from "./hudLayout";
import { destroyFrame, setFrameAlpha, setFrameEnabled, setFrameFont, setFrameSize, setFrameText, setFrameTextAlignment, setFrameTexture, setFrameVisible } from "wisp/game/frames";

const STRIP_WIDTH = f32(0.104);
const STRIP_HEIGHT = f32(0.108);
const STRIP_BOTTOM = f32(0.012);
const STRIP_MARGIN = f32(0.004);
const STRIP_ALPHA = 204;

export class HintStrip {
  private readonly panel: framehandle;
  private readonly label: framehandle;
  private shown = false;
  private shownKey: number | undefined;
  laidFor: boolean | undefined;

  constructor() {
    this.panel = createBackdrop("NewPlayerHintPanel", gameUi(), 893);
    setFrameTexture(this.panel, PANEL_TEXTURE, 0, true);
    setFrameAlpha(this.panel, STRIP_ALPHA);
    setFrameSize(this.panel, STRIP_WIDTH, STRIP_HEIGHT);
    setFrameEnabled(this.panel, false);
    setFrameVisible(this.panel, false);
    this.label = createText("NewPlayerHints", this.panel, 894);
    setFrameSize(this.label, f32(STRIP_WIDTH - 2 * STRIP_MARGIN), f32(STRIP_HEIGHT - 2 * STRIP_MARGIN));
    setFrameFont(this.label, MENU_FONT, f32(0.0074), 1);
    setFrameTextAlignment(this.label, TEXT_JUSTIFY_TOP, TEXT_JUSTIFY_LEFT);
    setFrameEnabled(this.label, false);
  }

  destroy(): void {
    destroyFrame(this.label);
    destroyFrame(this.panel);
  }

  isShown(): boolean {
    return this.shown;
  }

  place(count: number, hints: boolean): void {
    this.laidFor = hints;
    if (count < 1) return;
    const left = f32(hintStripLeft(count) + (HINT_STRIP_CELL - STRIP_WIDTH) / 2);
    const top = f32(STRIP_BOTTOM + STRIP_HEIGHT);
    placeTopLeft(this.panel, left, top);
    placeTopLeft(this.label, f32(left + STRIP_MARGIN), f32(top - STRIP_MARGIN));
  }

  update(visible: boolean, settings: Readonly<BindingSettings>, device: HintDevice): void {
    if (visible !== this.shown) {
      this.shown = visible;
      setFrameVisible(this.panel, visible);
    }
    const key = settings.revision * 2 + (device === "pad" ? 1 : 0);
    if (!visible || key === this.shownKey) return;
    this.shownKey = key;
    setFrameText(this.label, hintText(hintRows(device, settings.bindings, hintsKeyFree(settings)), MENU_STYLE.gold));
  }
}
