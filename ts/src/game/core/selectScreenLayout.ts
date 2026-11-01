import { f32 } from "wisp/src/sim/f32";

/** The select screen's side edges inside the 4:3 area: the top bar and the bottom row both span them. */
export const SELECT_EDGE_LEFT = f32(0.02);
export const SELECT_EDGE_RIGHT = f32(0.78);
const ROW_GAP = f32(0.006);

export const CARD_SCALE = f32(0.86);
export const CARD_WIDTH = f32(f32(0.16) * CARD_SCALE);
export const CARD_HEIGHT = f32(f32(0.22) * CARD_SCALE);
export const CARD_TOP = f32(0.198);
export const CARD_PITCH = f32(CARD_WIDTH + ROW_GAP);
/** The four fighter cards sit side by side, one gap apart, ending at the right edge. */
export const CARD_LEFT = f32(f32(SELECT_EDGE_RIGHT - f32(4 * CARD_WIDTH)) - f32(3 * ROW_GAP));

/** The select screens' chat slot: the bottom row left of the cards, as tall as they are, in 4:3 screen units with its bottom left corner at (left, bottom); the chat component draws inside it. */
export const CHAT_SLOT = { left: SELECT_EDGE_LEFT, bottom: f32(CARD_TOP - CARD_HEIGHT), width: f32(f32(CARD_LEFT - ROW_GAP) - SELECT_EDGE_LEFT), height: CARD_HEIGHT } as const;
