import { f32 } from "wisp/src/sim/f32";
import type { TextBox } from "./hudLayout";

export const HEADER_BUTTON_TOP = f32(0.588);
export const HEADER_BUTTON_HEIGHT = f32(0.023);

export const START_BUTTON = { x: f32(0.055), y: HEADER_BUTTON_TOP, width: f32(0.2), height: HEADER_BUTTON_HEIGHT } as const;

export const MOVES_BOX = { x: f32(0.265), y: HEADER_BUTTON_TOP, width: f32(0.12), height: HEADER_BUTTON_HEIGHT } as const;

export const SETTINGS_BOX = { x: f32(0.395), y: HEADER_BUTTON_TOP, width: f32(0.17), height: HEADER_BUTTON_HEIGHT } as const;

export const TUTORIAL_BOX = { x: f32(0.575), y: HEADER_BUTTON_TOP, width: f32(0.12), height: HEADER_BUTTON_HEIGHT } as const;

export const boxContains = (box: { readonly x: number; readonly y: number; readonly width: number; readonly height: number }, x: number, y: number): boolean =>
  x >= box.x && x <= f32(box.x + box.width) && y <= box.y && y >= f32(box.y - box.height);

export const startButtonContains = (x: number, y: number): boolean => boxContains(START_BUTTON, x, y);

export function selectionTitleBox(_aspect: number): TextBox {
  return { left: f32(0.055), top: f32(0.536), width: f32(0.285), height: f32(0.023) };
}


export const MOVES_TITLE_BOX: TextBox = { left: f32(0.12), top: f32(0.44), width: f32(0.56), height: f32(0.03) };
export const MOVES_BODY_BOX: TextBox = { left: f32(0.12), top: f32(0.4), width: f32(0.56), height: f32(0.3) };
export const MOVES_BUTTON_TOP = f32(0.075);
export const MOVES_BUTTON_HEIGHT = f32(0.032);
