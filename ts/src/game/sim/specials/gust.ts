import { f32 } from "wisp/src/sim/f32";
import { ContactKind } from "../codes";
import { isIntangible } from "../conditions";
import { collectDamageContact } from "../contacts";
import type { Fighter, Projectile } from "../fighter";
import { capsulesIntersect, emptyCapsule, hurtCapsule, placeCapsule } from "../geometry/contactGeometry";
import { type Roster, fighterAt, isActive } from "../roster";
import { shieldCircleIntersects } from "../shield";
import { canHit } from "../teams";
import { PARTICIPANT_CAPACITY } from "../../input/participants";
import type { ProjectileGust } from "./gustSchema";
import type { SpecialProjectile } from "./schema";
import { repelSpell } from "./spellImmunity";

const flight = emptyCapsule();
const body = emptyCapsule();

function reaches(target: Readonly<Fighter>): boolean {
  return capsulesIntersect(flight, placeCapsule(body, hurtCapsule(target.character), target.motion.x, target.motion.z, target.facing));
}

function sheltered(owner: Readonly<Fighter>, target: Readonly<Fighter>, gust: Readonly<ProjectileGust>): boolean {
  return !owner.status.out && Math.abs(f32(target.motion.x - owner.motion.x)) < gust.lee && f32(target.motion.z - owner.motion.z) < gust.leeHeight;
}

function pushOwner(owner: Fighter, direction: number, push: number): void {
  if (f32(owner.motion.vx * direction) < push) owner.motion.vx = f32(direction * push);
}

export function blowGust(world: Roster, ownerSlot: number, projectile: Projectile, spec: Readonly<SpecialProjectile>, gust: Readonly<ProjectileGust>, oldX: number, oldZ: number): void {
  flight.x1 = oldX;
  flight.z1 = oldZ;
  flight.x2 = projectile.x;
  flight.z2 = projectile.z;
  flight.radius = spec.radius;
  const owner = fighterAt(world, ownerSlot);
  for (let slot = 0; slot < PARTICIPANT_CAPACITY; slot++) {
    const bit = 1 << slot;
    if (!isActive(world, slot) || (projectile.gustStruck & bit) !== 0) continue;
    const target = fighterAt(world, slot);
    if (target.status.out) continue;
    if (slot === ownerSlot) {
      if (target.motion.grounded || !reaches(target)) continue;
      projectile.gustStruck |= bit;
      pushOwner(target, projectile.direction, gust.ownerPush);
      continue;
    }
    if (!canHit(world, ownerSlot, slot) || isIntangible(target) || sheltered(owner, target, gust)) continue;
    const shieldContact = target.shield.raised && shieldCircleIntersects(target, oldX, oldZ, projectile.x, projectile.z, 1.0, spec.radius);
    if (!shieldContact && !reaches(target)) continue;
    projectile.gustStruck |= bit;
    if (repelSpell(target)) continue;
    const effect = target.motion.grounded ? gust.groundedEffect : spec.effect;
    collectDamageContact(world, ownerSlot, slot, effect, projectile.direction, ContactKind.launch, false, undefined, shieldContact, spec.status, projectile.z);
  }
}
