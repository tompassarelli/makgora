import { PARTICIPANT_CAPACITY } from "../input/participants";
import { HeroStatusGroup, HeroStatusKind } from "../sim/codes";
import type { Fighter } from "../sim/fighter";
import { type Roster, fighterAt, isActive } from "../sim/roster";
import { runningHeroSpecial } from "../sim/specials/runningMove";
import { type ShockwaveRing, shockwaveRing } from "./shockwaveRing";

const SHAKE = [6.0, -5.0, 4.0, -3.0, 2.0, -1.0] as const;
const ring: ShockwaveRing = { x: 0.0, z: 0.0, radius: 0.0, alpha: 0 };

export function roaring(world: Roster, playing: boolean): boolean {
  if (!playing) return false;
  for (let slot = 0; slot < PARTICIPANT_CAPACITY; slot++) {
    if (isActive(world, slot) && shockwaveRing(ring, fighterAt(world, slot))?.alpha === 255) return true;
  }
  return false;
}

export function roarShake(world: Roster): number {
  for (let slot = 0; slot < PARTICIPANT_CAPACITY; slot++) {
    if (!isActive(world, slot)) continue;
    const fighter = fighterAt(world, slot);
    if (shockwaveRing(ring, fighter) === undefined) continue;
    const first = runningHeroSpecial(fighter)?.regions?.[0]?.firstFrame ?? 0;
    return SHAKE[fighter.special.frame - 1 - first] ?? 0.0;
  }
  return 0.0;
}

export function terrorResisted(fighter: Readonly<Fighter>, previousHits: number, roared: boolean): boolean {
  return roared && fighter.visuals.hit !== previousHits && fighter.motion.grounded && !fighter.shield.raised
    && fighter.status.condition !== HeroStatusKind.fear && (fighter.status.conditionImmunity[HeroStatusGroup.sleep] ?? 0) > 0;
}
