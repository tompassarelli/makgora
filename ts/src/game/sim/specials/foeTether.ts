import { f32 } from "wisp/src/sim/f32";
import { isIntangible } from "../conditions";
import type { Fighter } from "../fighter";
import { type Roster, fighterAt, isActive } from "../roster";
import { canHit } from "../teams";
import { PARTICIPANT_CAPACITY } from "../../input/participants";
import { FOLLOW_UP_FORM, type SpecialCharge } from "./schema";
import { spellImmune } from "./spellImmunity";

function takesTether(world: Roster, ownerSlot: number, slot: number): boolean {
  if (slot === ownerSlot || !isActive(world, slot) || !canHit(world, ownerSlot, slot)) return false;
  const foe = fighterAt(world, slot);
  return !foe.status.out && !isIntangible(foe) && !spellImmune(foe);
}

function nearestTakingFoe(world: Roster, ownerSlot: number, owner: Readonly<Fighter>): number {
  let nearest = -1;
  let distance = 0.0;
  for (let slot = 0; slot < PARTICIPANT_CAPACITY; slot++) {
    if (!takesTether(world, ownerSlot, slot)) continue;
    const foe = fighterAt(world, slot);
    const dx = f32(foe.motion.x - owner.motion.x);
    const dz = f32(foe.motion.z - owner.motion.z);
    const squared = f32(f32(dx * dx) + f32(dz * dz));
    if (nearest >= 0 && squared >= distance) continue;
    nearest = slot;
    distance = squared;
  }
  return nearest;
}

export function tetheredHold(f: Readonly<Fighter>, charge: Readonly<SpecialCharge> | undefined): boolean {
  return charge?.tether === true && f.special.form < FOLLOW_UP_FORM && f.special.frame === charge.hold + 1;
}

export function bindTether(world: Roster | undefined, f: Fighter, charge: Readonly<SpecialCharge> | undefined): boolean {
  if (charge?.tether !== true) return true;
  if (world === undefined || !tetheredHold(f, charge)) return false;
  const ownerSlot = world.fighters.indexOf(f);
  const bound = f.special.seekTarget - 1;
  if (bound >= 0 && takesTether(world, ownerSlot, bound)) return true;
  const slot = nearestTakingFoe(world, ownerSlot, f);
  f.special.seekTarget = slot + 1;
  if (slot >= 0) {
    const dx = f32(fighterAt(world, slot).motion.x - f.motion.x);
    if (dx !== 0.0) f.facing = dx < 0.0 ? -1 : 1;
  }
  return slot >= 0;
}
