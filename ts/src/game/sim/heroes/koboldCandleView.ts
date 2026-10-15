import { Character } from "../codes";
import type { Fighter } from "../fighter";

const sameReal = (a: number, b: number): boolean => a === b && (a !== 0 || 1 / a === 1 / b);

export function copyCandleView(target: Fighter, source: Readonly<Fighter>): void {
  const candle = target.candle;
  const from = source.candle;
  candle.state = from.state;
  candle.x = from.x;
  candle.z = from.z;
  candle.heat = from.heat;
  target.special.variant = source.special.variant;
}

export function sameCandleView(a: Readonly<Fighter>, b: Readonly<Fighter>): boolean {
  const c = a.candle;
  const d = b.candle;
  return c.state === d.state && sameReal(c.x, d.x) && sameReal(c.z, d.z) && c.heat === d.heat && a.special.variant === b.special.variant;
}

export function writeCandleView(number: (this: void, value: number) => void, f: Readonly<Fighter>): void {
  if (f.character !== Character.kobold) return;
  number(f.candle.state);
  number(f.candle.x);
  number(f.candle.z);
  number(f.candle.heat);
  number(f.special.variant);
}
