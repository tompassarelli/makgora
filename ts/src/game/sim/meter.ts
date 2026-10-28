import { max, min } from "../core/numbers";
import type { Fighter } from "./fighter";

export const ULTIMATE_METER_FRAMES = 7200;

export const ULTIMATE_FRAMES_PER_PERCENT = 72;

export const ultimatePercent = (percent: number): number => percent * ULTIMATE_FRAMES_PER_PERCENT;

export const ultimateCharged = (f: Readonly<Fighter>): boolean => f.meter.ultimate >= ULTIMATE_METER_FRAMES;

export function spendUltimate(f: Fighter): void {
  f.meter.ultimate = 0;
}

export function gainUltimate(f: Fighter, frames: number): void {
  if (frames > 0) f.meter.ultimate = min(ULTIMATE_METER_FRAMES, f.meter.ultimate + frames);
}

export function drainUltimate(f: Fighter, frames: number): void {
  if (frames > 0) f.meter.ultimate = max(0, f.meter.ultimate - frames);
}

export function fillMeter(f: Fighter): void {
  f.meter.ultimate = ULTIMATE_METER_FRAMES;
}

export function setMeterPercent(f: Fighter, percent: number): void {
  f.meter.ultimate = min(ULTIMATE_METER_FRAMES, ultimatePercent(max(0, percent)));
}
