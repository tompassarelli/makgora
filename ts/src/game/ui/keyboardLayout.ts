import { f32 } from "wisp/src/sim/f32";

export interface KeyCap {
  readonly key: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
}

const ROWS: readonly (readonly [indent: number, keys: string])[] = [
  [0, "1234567890-="],
  [0.5, "QWERTYUIOP[]"],
  [0.75, "ASDFGHJKL;"],
  [1.25, "ZXCVBNM,./"],
];

const SYMBOLS: Readonly<Record<string, number>> = { "-": 189, "=": 187, ";": 186, ",": 188, ".": 190, "/": 191, "[": 219, "]": 221 };
const SPACE = 32;
const F2 = 113;

export const KEY_CAP_HEIGHT = f32(0.042);
const KEY_CAP_WIDTH = f32(0.046);
const PITCH = f32(0.05);
const ROW_PITCH = f32(0.048);

export function keyboardCaps(left: number, top: number): KeyCap[] {
  const caps: KeyCap[] = [];
  ROWS.forEach(([indent, keys], row) => {
    const y = f32(top - f32(row * ROW_PITCH));
    for (let column = 0; column < keys.length; column++) {
      const character = keys.charAt(column);
      const x = f32(left + f32(f32(indent + column) * PITCH));
      caps.push({ key: SYMBOLS[character] ?? character.charCodeAt(0), x, y, width: KEY_CAP_WIDTH });
    }
  });
  const spaceY = f32(top - f32(ROWS.length * ROW_PITCH));
  caps.push({ key: F2, x: f32(left + f32(8 * PITCH)), y: spaceY, width: KEY_CAP_WIDTH });
  caps.push({ key: SPACE, x: f32(left + f32(2.5 * PITCH)), y: spaceY, width: f32(f32(5 * PITCH) - f32(PITCH - KEY_CAP_WIDTH)) });
  return caps;
}
