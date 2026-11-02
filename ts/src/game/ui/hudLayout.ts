


import { f32 } from "wisp/src/sim/f32";
import { MATCH_CLOCK_BOX as CLOCK_BOX } from "./clockLayout";
import { at } from "wisp/src/runtime/lookup";


export const NATIVE_TEXT_BASE = f32(0.0085);
export const MENU_FONT = "Fonts\\FRIZQT__.TTF";
/** Top edge of the one-line netplay warning, above the match chat's lines in the bottom-left corner. */
export const NET_INDICATOR_TOP = f32(0.215);
/** The dark tooltip backing behind every menu panel, readout and meter. */
export const PANEL_TEXTURE = "UI\\Widgets\\ToolTips\\Human\\human-tooltip-background.blp";
/** The arrow over a fighter in each slot colour. */
export const MARKER_ARROW_TEXTURES = ["war3mapImported\\MarkerArrow0.tga", "war3mapImported\\MarkerArrow1.tga", "war3mapImported\\MarkerArrow2.tga", "war3mapImported\\MarkerArrow3.tga"] as const;
export const markerArrowTexture = (color: number): string => at(MARKER_ARROW_TEXTURES, color);
export const MENU_STYLE = {
  font: MENU_FONT,
  panelTexture: "war3mapImported\\SelectionBackdrop.tga",
  borderTexture: "war3mapImported\\SelectionTileFrame.tga",
  titleSize: f32(0.024),
  headerSize: f32(0.012),
  bodySize: f32(0.010),
  bodyInset: f32(0.02),
  gold: "|cffffcc00",
  text: "|cffd9e4eb",
} as const;

export interface TextBox {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}


export const MATCH_HELP_BOX: TextBox = { left: f32(0.06), top: f32(0.54), width: f32(0.58), height: f32(0.055) };

export const MATCH_NOTICE_BOX: TextBox = { left: f32(0.06), top: f32(0.47), width: f32(0.34), height: f32(0.07) };

export const MATCH_CLOCK_BOX: TextBox = CLOCK_BOX;

export const MATCH_COUNTDOWN_BOX: TextBox = { left: f32(0.2), top: f32(0.41), width: f32(0.4), height: f32(0.14) };

export const TRAINING_READOUT_BOX: TextBox = { left: f32(0.02), top: f32(0.48), width: f32(0.23), height: f32(0.08) };

const READOUT_MARGIN = f32(0.004);
export const TRAINING_READOUT_PANEL: TextBox = {
  left: TRAINING_READOUT_BOX.left - READOUT_MARGIN,
  top: TRAINING_READOUT_BOX.top + READOUT_MARGIN,
  width: TRAINING_READOUT_BOX.width + 2 * READOUT_MARGIN,
  height: TRAINING_READOUT_BOX.height + 2 * READOUT_MARGIN,
};





export const TRAINING_READOUT_PANEL_ALPHA = 204;
