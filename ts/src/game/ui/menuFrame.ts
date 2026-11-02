import { f32 } from "wisp/src/sim/f32";

export const MENU_FRAME_CORNER = f32(0.02);
export const MENU_FRAME_BAND = f32(0.012);
export const MENU_FRAME_PIECES = ["TopLeft", "Top", "TopRight", "Left", "Right", "BottomLeft", "Bottom", "BottomRight"] as const;
export type MenuFramePiece = (typeof MENU_FRAME_PIECES)[number];
export const menuFrameName = (piece: MenuFramePiece): string => `MenuFrame${piece}`;
export const menuFrameTexture = (piece: MenuFramePiece): string => `war3mapImported\\${menuFrameName(piece)}.tga`;
