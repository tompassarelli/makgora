import { canHit } from "./teams";





import { f32 } from "wisp/src/sim/f32";
import { AttackStyle, ProjectileKind } from "./codes";
import { mutableProjectile } from "./fighterProjectiles";
import { inGrabContext } from "./conditions";
import { staggerCompanion } from "./companions";
import { type Fighter, type PlacedObject, placedObject } from "./fighter";
import { HERO_PROJECTILE_CAP, runningHeroSpecial, spawnHeroProjectileAt } from "./heroSpecialRules";
import { CompanionMode, type SpecialPlacement } from "./heroSpecials";
import { authoredHitRegion, authoredHitRegionCount, emptyHitRegion } from "./hitRegions";
import { projectileDamage } from "./projectiles";
import { type Roster, fighterAt, isActive } from "./roster";
import { attackCapsule, capsulesIntersect, emptyCapsule, placeCapsule } from "../physics/contactGeometry";
import { PARTICIPANT_CAPACITY } from "../input/participants";


const ORIGINAL_PROJECTILE_RADIUS = 12.0;


const body = emptyCapsule();
const strike = emptyCapsule();
const region = emptyHitRegion();

function placeBody(placed: Readonly<PlacedObject>, spec: Readonly<SpecialPlacement>): void {
  body.x1 = placed.x;
  body.x2 = placed.x;
  body.z1 = f32(placed.z + spec.radius);
  body.z2 = f32(f32(placed.z + spec.height) - spec.radius);
  body.radius = spec.radius;
}


function normalStrike(placed: PlacedObject, sourceSlot: number, source: Readonly<Fighter>): number {
  const { attack } = source;
  const style = attack.style;
  if (style === undefined || style === AttackStyle.grab || attack.dashGrab || placed.struck[sourceSlot] === attack.serial) return 0.0;
  const moves = source.tuning.moves;
  for (let index = 0; index < authoredHitRegionCount(style, moves); index++) {
    authoredHitRegion(region, source.character, style, attack.frame, attack.smashChargeFrames, index, moves);
    if (region.window <= 0) continue;
    attackCapsule(strike, style, region);
    placeCapsule(strike, strike, source.motion.x, source.motion.z, source.facing);
    if (!capsulesIntersect(strike, body)) continue;
    placed.struck[sourceSlot] = attack.serial;
    return region.effect.damage;
  }
  return 0.0;
}


function specialStrike(placed: PlacedObject, sourceSlot: number, source: Readonly<Fighter>): number {
  const bit = 1 << sourceSlot;
  const move = runningHeroSpecial(source);
  if (move === undefined || source.special.frame <= 1) placed.specialStruck &= ~bit;
  if (move === undefined || (placed.specialStruck & bit) !== 0) return 0.0;
  const frame = source.special.frame - 1;
  for (const path of move.regions ?? []) {
    if (frame < path.firstFrame || frame > path.lastFrame || path.hit.strike === undefined) continue;
    placeCapsule(strike, path.hit.strike, source.motion.x, source.motion.z, source.facing);
    if (!capsulesIntersect(strike, body)) continue;
    placed.specialStruck |= bit;
    return path.hit.effect.damage;
  }
  return 0.0;
}


function projectileStrikes(source: Fighter): number {
  let damage = 0.0;
  let index = -1;
  for (const projectile of source.projectiles) {
    index++;
    if (projectile.life <= 0) continue;
    strike.x1 = f32(projectile.x - projectile.velocityX);
    strike.z1 = f32(projectile.z - projectile.velocityZ);
    strike.x2 = projectile.x;
    strike.z2 = projectile.z;
    strike.radius = projectile.kind === ProjectileKind.hero && projectile.spec !== undefined ? projectile.spec.radius : ORIGINAL_PROJECTILE_RADIUS;
    if (!capsulesIntersect(strike, body)) continue;
    damage = f32(damage + projectileDamage(projectile));
    mutableProjectile(source, index).life = 0;
  }
  return damage;
}

function ownedProjectiles(f: Readonly<Fighter>): number {
  let count = 0;
  for (const projectile of f.projectiles) if (projectile.life > 0 && projectile.kind === ProjectileKind.hero) count++;
  return count;
}


function towardNearestFoe(world: Roster, ownerSlot: number, placed: Readonly<PlacedObject>): number {
  let direction = placed.direction;
  let nearest = -1.0;
  for (let slot = 0; slot < PARTICIPANT_CAPACITY; slot++) {
    if (slot === ownerSlot || !isActive(world, slot)) continue;
    const foe = fighterAt(world, slot);
    if (foe.status.out) continue;
    const dx = f32(foe.motion.x - placed.x);
    const dz = f32(foe.motion.z - placed.z);
    const squared = f32(f32(dx * dx) + f32(dz * dz));
    if (nearest >= 0.0 && squared >= nearest) continue;
    nearest = squared;
    if (dx !== 0.0) direction = dx < 0.0 ? -1 : 1;
  }
  return direction;
}

export function advancePlacedObjects(world: Roster): void {
  for (let ownerSlot = 0; ownerSlot < PARTICIPANT_CAPACITY; ownerSlot++) {
    if (!isActive(world, ownerSlot)) continue;
    const owner = fighterAt(world, ownerSlot);
    for (let animal = 0; animal <= owner.pack.length; animal++) {
      const placed = placedObject(owner, animal);
      const spec = placed.spec;
      if (placed.life <= 0 || spec === undefined) continue;
      const channeled = spec.channeled === true;
      if (channeled && runningHeroSpecial(owner)?.placement !== spec) {
        placed.life = 0;
        continue;
      }
      const crumble = spec.crumble ?? 0;
      placeBody(placed, spec);
      for (let sourceSlot = 0; sourceSlot < PARTICIPANT_CAPACITY && placed.life > crumble; sourceSlot++) {
        if (!canHit(world, sourceSlot, ownerSlot) || !isActive(world, sourceSlot)) continue;
        const source = fighterAt(world, sourceSlot);
        if (source.status.out) continue;
        const damage = f32(f32(normalStrike(placed, sourceSlot, source) + specialStrike(placed, sourceSlot, source)) + projectileStrikes(source));
        if (!channeled) placed.durability = f32(placed.durability - damage);
        if (damage > 0.0) staggerCompanion(placed);
      }
      placed.age++;
      placed.life--;
      if (placed.durability <= 0.0 && placed.life > crumble) placed.life = crumble;
      if (placed.life <= crumble) continue;
      let scheduled = false;
      for (const age of spec.fireAges) if (age === placed.age) scheduled = true;
      const fires = scheduled && placed.mode === CompanionMode.follow && !inGrabContext(owner) && owner.launch.hitstun <= 0 && !owner.status.out;
      const last = spec.fireAges[spec.fireAges.length - 1];
      const shot = spec.finalShot !== undefined && placed.age === last ? spec.finalShot : spec.shot;
      if (fires && shot !== undefined && (channeled || ownedProjectiles(owner) < HERO_PROJECTILE_CAP)) {
        if (spec.aimed === true) placed.direction = towardNearestFoe(world, ownerSlot, placed);
        const x = f32(placed.x + f32(placed.direction * shot.offsetX));
        spawnHeroProjectileAt(owner, shot, x, f32(placed.z + shot.offsetZ), placed.direction, false, owner.attack.serial + 1);
      }
    }
  }
}
