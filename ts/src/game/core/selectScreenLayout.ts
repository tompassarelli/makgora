import { f32 } from "wisp/src/sim/f32";

/** A box in 4:3 screen units by its top left corner. */
export interface ScreenBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

const box = (x: number, y: number, width: number, height: number): ScreenBox => ({ x: f32(x), y: f32(y), width: f32(width), height: f32(height) });

/** The select screens' side edges inside the 4:3 area: the top bar, the body and the bottom row all span them. */
export const SELECT_EDGE_LEFT = f32(0.02);
export const SELECT_EDGE_RIGHT = f32(0.78);
const ROW_GAP = f32(0.006);
const BODY_GAP = f32(0.008);

export const BAR_TOP = f32(0.594);
export const BAR_HEIGHT = f32(0.03);
/** The dark band the top bar sits on; the 4:3 part of it, which the band stretches past to both window edges. */
export const BAR_STRIP = box(0, f32(0.6), f32(0.8), f32(f32(f32(0.6) - f32(BAR_TOP - BAR_HEIGHT)) + f32(0.008)));
const BAR_LINE_HEIGHT = f32(f32(3) / f32(1800));
/** The gold line along the band's bottom edge, across the 4:3 area only. */
export const BAR_LINE = box(0, f32(f32(BAR_STRIP.y - BAR_STRIP.height) + BAR_LINE_HEIGHT), f32(0.8), BAR_LINE_HEIGHT);

export const CARD_SCALE = f32(0.86);
export const CARD_WIDTH = f32(f32(0.16) * CARD_SCALE);
export const CARD_HEIGHT = f32(f32(0.22) * CARD_SCALE);
export const CARD_TOP = f32(0.198);
export const CARD_PITCH = f32(CARD_WIDTH + ROW_GAP);
/** The four fighter cards sit side by side, one gap apart, ending at the right edge. */
export const CARD_LEFT = f32(f32(SELECT_EDGE_RIGHT - f32(4 * CARD_WIDTH)) - f32(3 * ROW_GAP));

/** The select screens' chat slot: the bottom row left of the cards, as tall as they are, in 4:3 screen units with its bottom left corner at (left, bottom); the chat component draws inside it. */
export const CHAT_SLOT = { left: SELECT_EDGE_LEFT, bottom: f32(CARD_TOP - CARD_HEIGHT), width: f32(f32(CARD_LEFT - ROW_GAP) - SELECT_EDGE_LEFT), height: CARD_HEIGHT } as const;

const BODY_TOP = f32(f32(BAR_STRIP.y - BAR_STRIP.height) - BODY_GAP);
/** The band between the bar's strip and the bottom row, where each select screen puts its main content. */
export const SELECT_BODY = box(SELECT_EDGE_LEFT, BODY_TOP, f32(SELECT_EDGE_RIGHT - SELECT_EDGE_LEFT), f32(BODY_TOP - f32(CARD_TOP + BODY_GAP)));

const HALF_WIDTH = f32(f32(SELECT_BODY.width - f32(2 * ROW_GAP)) / 2);
/** Stage select's two equal boxes across the body: the chosen stage's preview at the left, the stage list at the right. */
export const STAGE_PREVIEW_BOX = box(SELECT_BODY.x, SELECT_BODY.y, HALF_WIDTH, SELECT_BODY.height);
export const STAGE_LIST_BOX = box(f32(f32(SELECT_BODY.x + HALF_WIDTH) + f32(2 * ROW_GAP)), SELECT_BODY.y, HALF_WIDTH, SELECT_BODY.height);
