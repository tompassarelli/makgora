import { f32 } from "wisp/src/sim/f32";
import { floorDiv } from "wisp/src/sim/intMath";
import { type Roster, fighterAt, isActive } from "../sim/roster";
import { runningHeroSpecial } from "../sim/specials/runningMove";
import { PARTICIPANT_CAPACITY, PARTICIPANT_SLOTS } from "../input/participants";

export const CRITICAL_STRIKE_COLOUR = { red: 255, green: 0, blue: 0 } as const;
export const CRITICAL_STRIKE_FRAMES = 90;
export const CRITICAL_STRIKE_FADE_FRAMES = 36;
export const CRITICAL_STRIKE_RISE = f32(1.2);
export const CRITICAL_STRIKE_HEAD = 170.0;
const CRITICAL_STRIKE_SIZE = { least: 10.0, perDamage: f32(0.4) } as const;
const TEXT_TAG_HEIGHT_PER_SIZE = f32(0.0023);

function struckCritically(world: Readonly<Roster>, victimSlot: number): boolean {
  for (const slot of PARTICIPANT_SLOTS) {
    if (slot === victimSlot || !isActive(world, slot)) continue;
    const attacker = fighterAt(world, slot);
    if (runningHeroSpecial(attacker)?.critical !== true) continue;
    for (let entry = 0; entry < PARTICIPANT_CAPACITY; entry++) if (attacker.special.hitTargets[entry] === victimSlot) return true;
  }
  return false;
}

export function criticalStrikeDamage(world: Readonly<Roster>, victimSlot: number, struck: boolean, damageBefore: number): number | undefined {
  const victim = fighterAt(world, victimSlot);
  if (!struck || !struckCritically(world, victimSlot)) return undefined;
  const dealt = f32(victim.status.damage - damageBefore);
  return dealt > 0.0 ? dealt : undefined;
}

export function criticalStrikeText(damage: number): string {
  return `${Math.floor(f32(damage + 0.5))}!`;
}

export function criticalStrikeSize(damage: number): number {
  return f32(CRITICAL_STRIKE_SIZE.least + f32(damage * CRITICAL_STRIKE_SIZE.perDamage));
}

export function criticalStrikeHeight(damage: number): number {
  return f32(criticalStrikeSize(damage) * TEXT_TAG_HEIGHT_PER_SIZE);
}

export function criticalStrikeAlpha(age: number): number {
  const left = CRITICAL_STRIKE_FRAMES - age;
  return left >= CRITICAL_STRIKE_FADE_FRAMES ? 255 : left <= 0 ? 0 : floorDiv(left * 255, CRITICAL_STRIKE_FADE_FRAMES);
}
