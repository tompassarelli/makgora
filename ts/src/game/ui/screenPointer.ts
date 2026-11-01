import { screenHeight, screenWidth } from "wisp/game/frames";
import { pointerX as inputPointerX, pointerY as inputPointerY } from "wisp/game/input";
import { toReal } from "wisp/game/text";
import { pointerX, pointerY } from "../menu/pointer";

export interface ScreenPointer {
  readonly pointed: boolean;
  readonly x: number;
  readonly y: number;
}

const POINTER = { pointed: false, x: 0.0, y: 0.0 };

// Lua: one shared record, because the select panel reads it on every match frame and a fresh table each frame is garbage.
export function readScreenPointer(): ScreenPointer {
  const width = toReal(screenWidth());
  const height = toReal(screenHeight());
  POINTER.pointed = width > 0 && height > 0;
  POINTER.x = POINTER.pointed ? pointerX(toReal(inputPointerX()), width, height) : 0.0;
  POINTER.y = POINTER.pointed ? pointerY(toReal(inputPointerY()), height) : 0.0;
  return POINTER;
}
