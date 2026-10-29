import { TILE_TEXTURE_PX } from '../src/game/ui/portraitFrames';

/** Behind every grid tile, so the tiles read as one set. */
export const TILE_BACKGROUND = ['-size', `${TILE_TEXTURE_PX}x${TILE_TEXTURE_PX}`, 'radial-gradient:#3a5378-#0c1422'];

/** The Random tile's "?" fills this share of the tile's width and height. */
export const RANDOM_ICON_PX = Math.round(TILE_TEXTURE_PX * 0.72);
