import { f32 } from "wisp/src/sim/f32";
import { floorMod } from "wisp/src/sim/intMath";
import type { Fighter } from "../sim/fighter";
import { hurtCapsule } from "../sim/geometry/contactGeometry";
import type { Character } from "../sim/codes";
import { sineTurns } from "../sim/mathTables";
import type { ItemColor } from "./itemLook";
import { fighterModelReplaced } from "./fighterForm";
import { ultimateReady } from "./meterCues";

export const METER_GLOW_GROW = f32(1.09);
export const METER_GLOW_DEPTH = 14.0;
export const FULL_GLOW: ItemColor = { red: 255, green: 196, blue: 64 };
export const FULL_GLOW_ALPHA = 160;
export const FULL_GLOW_SWING = 50;
export const FULL_GLOW_PERIOD = 120;

export function meterGlowColor(fighter: Readonly<Fighter>, ultimatesOff: boolean): ItemColor | undefined {
  if (fighterModelReplaced(fighter)) return undefined;
  return ultimateReady(fighter, ultimatesOff) ? FULL_GLOW : undefined;
}

export function meterGlowAlpha(frame: number): number {
  return FULL_GLOW_ALPHA + Math.floor(FULL_GLOW_SWING * sineTurns(floorMod(frame, FULL_GLOW_PERIOD) / FULL_GLOW_PERIOD));
}

export function meterGlowHeight(character: Character): number {
  const body = hurtCapsule(character);
  return f32(body.z2 + body.radius);
}
