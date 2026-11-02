import { f32 } from "wisp/src/sim/f32";

export const SCREEN_HEIGHT_UNITS = f32(0.6);
export const SCREEN_CENTRE_X = f32(0.4);

/** Melee's match clock digit heights as shares of the full frame's height, measured on uncropped 4:3 captures (docs/design/match-flow.md, "Clock size"). */
export const MELEE_CLOCK_SHARE = {
  digitHeight: f32(0.05),
  hundredthsHeight: f32(0.0417),
} as const;

/** Our own choice, not Melee's 11.25%: the share of the screen height between the top edge and the main digits' outline (docs/design/match-flow.md, "Clock size"). */
export const CLOCK_TOP_MARGIN_SHARE = f32(0.04);

/** Our digits' glyph box in the Wisp window, calibrated on native 1280x720 captures: outer height with outline is HEIGHT_PER_SIZE * size + OUTLINE_ALLOWANCE. */
const HEIGHT_PER_SIZE = f32(0.8148);
const OUTLINE_ALLOWANCE = f32(0.00176);
const MAIN_WIDTH_PER_SIZE = f32(2.78);
const HUNDREDTHS_WIDTH_PER_SIZE = f32(1.18);
const BOTTOM_PAD_PER_SIZE = f32(0.284);
const BOX_SLACK = f32(0.006);
const HUNDREDTHS_DROP = f32(0.00125);
const GAP = f32(0.004);

export const clockOuterShare = (size: number): number => (HEIGHT_PER_SIZE * size + OUTLINE_ALLOWANCE) / SCREEN_HEIGHT_UNITS;

const sizeForShare = (share: number): number => f32((share * SCREEN_HEIGHT_UNITS - OUTLINE_ALLOWANCE) / HEIGHT_PER_SIZE);

export const CLOCK_DIGIT_SIZE = sizeForShare(MELEE_CLOCK_SHARE.digitHeight);
export const CLOCK_HUNDREDTHS_SIZE = sizeForShare(MELEE_CLOCK_SHARE.hundredthsHeight);

const mainWidth = f32(MAIN_WIDTH_PER_SIZE * CLOCK_DIGIT_SIZE);
const hundredthsWidth = f32(HUNDREDTHS_WIDTH_PER_SIZE * CLOCK_HUNDREDTHS_SIZE);
const mainOuterHeight = HEIGHT_PER_SIZE * CLOCK_DIGIT_SIZE + OUTLINE_ALLOWANCE;
const mainPad = BOTTOM_PAD_PER_SIZE * CLOCK_DIGIT_SIZE;
const hundredthsPad = BOTTOM_PAD_PER_SIZE * CLOCK_HUNDREDTHS_SIZE;

export const CLOCK_GAP = GAP;
export const CLOCK_SPLIT_X = f32(SCREEN_CENTRE_X - (mainWidth + GAP + hundredthsWidth) / 2 + mainWidth);
/** Top of the main digits' outline. */
export const CLOCK_GLYPH_TOP = f32(SCREEN_HEIGHT_UNITS * (1 - CLOCK_TOP_MARGIN_SHARE));
export const CLOCK_TOP = f32(CLOCK_GLYPH_TOP + BOX_SLACK);
const mainBottom = CLOCK_GLYPH_TOP - mainOuterHeight - mainPad;
export const CLOCK_MAIN_BOX = { width: f32(mainWidth + BOX_SLACK), height: f32(CLOCK_TOP - mainBottom) } as const;
export const CLOCK_HUNDREDTHS_BOX = { width: f32(hundredthsWidth + BOX_SLACK), height: f32(HEIGHT_PER_SIZE * CLOCK_HUNDREDTHS_SIZE + hundredthsPad + OUTLINE_ALLOWANCE + BOX_SLACK) } as const;
export const CLOCK_HUNDREDTHS_TOP = f32(mainBottom + (mainPad - hundredthsPad) - HUNDREDTHS_DROP + CLOCK_HUNDREDTHS_BOX.height);
export const CLOCK_MAIN_LEFT = f32(CLOCK_SPLIT_X - CLOCK_MAIN_BOX.width);
export const CLOCK_HUNDREDTHS_LEFT = f32(CLOCK_SPLIT_X + CLOCK_GAP);

export const MATCH_CLOCK_BOX = {
  left: CLOCK_MAIN_LEFT,
  top: CLOCK_TOP,
  width: f32(CLOCK_HUNDREDTHS_LEFT + CLOCK_HUNDREDTHS_BOX.width - CLOCK_MAIN_LEFT),
  height: CLOCK_MAIN_BOX.height,
} as const;
