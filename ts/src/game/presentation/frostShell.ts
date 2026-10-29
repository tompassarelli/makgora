import { f32 } from "wisp/src/sim/f32";
import { floorDiv, imod } from "wisp/src/sim/intMath";
import { Character } from "../sim/codes";
import type { Fighter } from "../sim/fighter";

/** Frost Armor's shell pulses and shrinks through its last second; particle emitters ignore alpha (render/effects.ts), so scale is the only dimmer and the shell is never hidden while it holds. */
export const FROST_SHELL_FADE_FRAMES = 60;
const BLINK_PERIOD = 8;
const SHRUNK = f32(0.55);
const DIM = f32(0.5);

/** The shell's scale on this frame: 0 only once `armorFrames` is spent (it is absorbed, shattered, expired or the fighter is out), at `full` while it holds, pulsing smaller through its last second. */
export function frostShellScale(fighter: Readonly<Fighter>, full: number): number {
  const left = fighter.status.armorFrames;
  if (fighter.character !== Character.lich || left <= 0 || fighter.status.out) return 0.0;
  if (left >= FROST_SHELL_FADE_FRAMES) return full;
  const lit = imod(left, BLINK_PERIOD) < floorDiv(left + BLINK_PERIOD - 1, BLINK_PERIOD);
  const envelope = f32(SHRUNK + f32(f32(1.0 - SHRUNK) * f32(left / FROST_SHELL_FADE_FRAMES)));
  return f32(full * (lit ? envelope : f32(envelope * DIM)));
}
