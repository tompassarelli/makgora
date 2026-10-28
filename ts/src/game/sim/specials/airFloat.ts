import { f32 } from "wisp/src/sim/f32";
import { SpecialAction } from "../codes";
import type { Fighter } from "../fighter";
import type { Controls } from "../roster";
import type { AuthoredSpecial } from "./schema";

export const ULTIMATE_AIR_CAST = 1;

export function castFloating(f: Readonly<Fighter>, move: Readonly<AuthoredSpecial>): boolean {
  return move.airFloat !== undefined && f.special.action === SpecialAction.heroUltimate && f.special.variant === ULTIMATE_AIR_CAST;
}

export function floatsNow(f: Readonly<Fighter>, move: Readonly<AuthoredSpecial>): boolean {
  const window = move.airStall;
  return castFloating(f, move) && window !== undefined && f.special.frame >= window.first && f.special.frame <= window.last && !f.motion.grounded;
}

export function airCastVariant(f: Readonly<Fighter>, move: Readonly<AuthoredSpecial>): number {
  return move.airFloat !== undefined && !f.motion.grounded ? ULTIMATE_AIR_CAST : 0;
}

export function stallAir(f: Fighter, move: Readonly<AuthoredSpecial>, frame: number, input: Readonly<Controls> | undefined): void {
  if (move.airFloat !== undefined && f.motion.grounded) f.special.variant = 0;
  const window = move.airStall;
  if (window === undefined || frame < window.first || frame > window.last || f.motion.grounded) return;
  if (move.airFloat === undefined) f.motion.vz = 0.0;
  else if (castFloating(f, move)) f.motion.vz = airFloatVelocity(f, move, input);
}

function airFloatVelocity(f: Readonly<Fighter>, move: Readonly<AuthoredSpecial>, input: Readonly<Controls> | undefined): number {
  const float = move.airFloat;
  if (float === undefined || input === undefined || !castFloating(f, move)) return 0.0;
  const rising = input.jumpHeld || input.jumpPressed || input.shortHopPressed;
  return f32(f32(rising ? float.rise : 0.0) - f32(input.down ? float.sink : 0.0));
}
