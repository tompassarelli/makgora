import { max, min } from "../core/numbers";
import type { Fighter } from "./fighter";

export const METER = { exFrames: 720, ultimateFrames: 7200 } as const;

export const ULTIMATE_FRAMES_PER_PERCENT = 72;

export const ultimatePercent = (percent: number): number => percent * ULTIMATE_FRAMES_PER_PERCENT;

export const exCharged = (f: Readonly<Fighter>): boolean => f.meter.ex >= METER.exFrames;

export const ultimateCharged = (f: Readonly<Fighter>): boolean => f.meter.ultimate >= METER.ultimateFrames;

export function regenerateMeter(f: Fighter): void {
  if (f.meter.ex < METER.exFrames) f.meter.ex++;
  if (f.meter.ultimate < METER.ultimateFrames) f.meter.ultimate++;
}

export function fillEx(f: Fighter): void {
  f.meter.ex = METER.exFrames;
}

export function spendEx(f: Fighter): void {
  f.meter.ex = 0;
}

export function spendUltimate(f: Fighter): void {
  f.meter.ultimate = 0;
}

export function gainUltimate(f: Fighter, frames: number): void {
  if (frames > 0) f.meter.ultimate = min(METER.ultimateFrames, f.meter.ultimate + frames);
}

export function drainUltimate(f: Fighter, frames: number): void {
  if (frames > 0) f.meter.ultimate = max(0, f.meter.ultimate - frames);
}

export function fillMeter(f: Fighter): void {
  f.meter.ex = METER.exFrames;
  f.meter.ultimate = METER.ultimateFrames;
}

export function setMeterPercent(f: Fighter, percent: number): void {
  f.meter.ex = percent >= 100 ? METER.exFrames : 0;
  f.meter.ultimate = min(METER.ultimateFrames, ultimatePercent(max(0, percent)));
}
