import { idiv, imod } from "wisp/src/sim/intMath";

export const CLOCK_TICKS_PER_SECOND = 60;
const DIGITS = "0123456789";

const twoDigits = (value: number): string => `${DIGITS.charAt(idiv(value, 10))}${DIGITS.charAt(imod(value, 10))}`;

let hundredthsText: string[] | undefined;

// Hundredths round up so a running clock never shows 00 before its last frame.
export function clockHundredths(frames: number): number {
  return idiv(imod(frames, CLOCK_TICKS_PER_SECOND) * 100 + CLOCK_TICKS_PER_SECOND - 1, CLOCK_TICKS_PER_SECOND);
}

export function hundredthsLabel(hundredths: number): string {
  if (hundredthsText === undefined) {
    hundredthsText = [];
    for (let value = 0; value < 100; value++) hundredthsText.push(twoDigits(value));
  }
  return hundredthsText[hundredths] ?? "00";
}

export function clockSeconds(frames: number): number {
  return idiv(frames, CLOCK_TICKS_PER_SECOND);
}

export function clockMain(seconds: number): string {
  return `${twoDigits(idiv(seconds, 60))}:${twoDigits(imod(seconds, 60))}`;
}
