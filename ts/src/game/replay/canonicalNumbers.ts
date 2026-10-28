import { floorDiv, floorMod } from "wisp/src/sim/intMath";

function writeIntegerBytes(emit: (code: number) => void, value: number): void {
  if (value < -2147483648 || value > 2147483647) {
    const text = `${value}`;
    for (let index = 0; index < text.length; index++) emit(text.charCodeAt(index));
    return;
  }
  if (value < 0) emit(45);
  let remaining = value > 0 ? -value : value;
  let divisor = 1;
  while (divisor < 1_000_000_000 && remaining <= -10 * divisor) divisor *= 10;
  while (divisor > 0) {
    const digit = -floorDiv(remaining, divisor) - (floorMod(remaining, divisor) === 0 ? 0 : 1);
    emit(48 + digit);
    remaining += digit * divisor;
    divisor = floorDiv(divisor, 10);
  }
}

export function writeCanonicalNumber(emit: (code: number) => void, value: number, integer = true): void {
  if (integer && Math.floor(value) === value) { writeIntegerBytes(emit, Math.floor(value)); return; }
  if (value !== value) { emit(110); emit(97); emit(110); return; }
  const negative = value < 0;
  if (!negative && !(value > 0)) { emit(48); return; }
  emit(negative ? 45 : 43);
  if (!splitFiniteReal(negative ? -value : value)) { emit(105); emit(110); emit(102); return; }
  writeIntegerBytes(emit, realParts.exponent);
  emit(58);
  writeIntegerBytes(emit, realParts.high);
  emit(58);
  writeIntegerBytes(emit, realParts.low);
}

export const realParts = { exponent: 0, high: 0, low: 0 };

export function splitFiniteReal(positive: number): boolean {
  let magnitude = positive;
  if (magnitude * 2 === magnitude) return false;
  let exponent = 0;
  while (magnitude >= 2) {
    magnitude /= 2;
    exponent++;
  }
  while (magnitude < 1) {
    magnitude *= 2;
    exponent--;
  }
  const fraction = (magnitude - 1) * 67108864;
  const high = Math.floor(fraction);
  realParts.exponent = exponent;
  realParts.high = high;
  realParts.low = Math.floor((fraction - high) * 67108864);
  return true;
}

export function canonicalReal(value: number): string {
  if (value !== value) return "nan";
  const negative = value < 0;
  if (!negative && !(value > 0)) return "0";
  const sign = negative ? "-" : "+";
  if (!splitFiniteReal(negative ? -value : value)) return `${sign}inf`;
  return `${sign}${canonicalNumber(realParts.exponent)}:${canonicalNumber(realParts.high)}:${canonicalNumber(realParts.low)}`;
}

// Lua prints integral floats with .0; floor them to integers to match Wurst I2S.

export function canonicalNumber(value: number): string {
  const whole = Math.floor(value);
  return whole === value ? `${whole}` : canonicalReal(value);
}

export function canonicalInt(name: string, value: number): string {
  return `|${name}=${canonicalNumber(value)}`;
}

export function canonicalRealField(name: string, value: number): string {
  return `|${name}=${canonicalReal(value)}`;
}
