import { idiv, imod } from "wisp/src/sim/intMath";
import type { Fighter } from "./fighter";
import type { AuthoredSpecial, FighterSpecials, SpecialKit } from "./specials/schema";
import { OLDEST_WEIGHT, type StickMotion, motionCompleted, zoneCode } from "./stickMotion";

export function recordStick(f: Fighter, sectorX: number, sectorZ: number): void {
  const { stick } = f;
  stick.older = imod(stick.older, OLDEST_WEIGHT) * 16 + idiv(stick.recent, OLDEST_WEIGHT);
  stick.recent = imod(stick.recent, OLDEST_WEIGHT) * 16 + zoneCode(sectorX, sectorZ);
}

export function stickMoved(f: Readonly<Fighter>, motion: Readonly<StickMotion>): boolean {
  return motionCompleted(f.stick.recent, f.stick.older, f.facing < 0 ? -1 : 1, motion);
}

const moveReadsMotion = (move: Readonly<AuthoredSpecial> | undefined): boolean => move?.aimByMotion !== undefined || move?.variantByMotion !== undefined;

const kitReadsMotion = (kit: Readonly<SpecialKit>): boolean => kit.selectedByMotion !== undefined || moveReadsMotion(kit.ground) || moveReadsMotion(kit.air);

export function motionVariant(f: Readonly<Fighter>, move: Readonly<AuthoredSpecial>): number | undefined {
  for (const pick of move.variantByMotion ?? []) if (stickMoved(f, pick.motion)) return pick.variant;
  return undefined;
}

export function readsStickMotion(specials: Readonly<FighterSpecials>): boolean {
  return kitReadsMotion(specials.neutral) || kitReadsMotion(specials.side) || kitReadsMotion(specials.up) || kitReadsMotion(specials.down);
}
