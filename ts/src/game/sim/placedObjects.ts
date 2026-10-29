import { canHit } from "./teams";





import { f32 } from "wisp/src/sim/f32";
import { AttackStyle, ProjectileKind, SpecialAction } from "./codes";
import { mutableProjectile } from "./fighterProjectiles";
import { inGrabContext } from "./conditions";
import { staggerCompanion } from "./companions";
import { type Fighter, type PlacedObject, mutablePlacedObject, placedObject } from "./fighter";
import type { Resting } from "./fighterRest";
import { HERO_PROJECTILE_CAP, spawnHeroProjectileAt } from "./specials/heroProjectiles";
import { placeHeroStrike } from "./specials/heroContact";
import { runningHeroSpecial } from "./specials/runningMove";
import { CompanionMode, type SpecialPlacement } from "./specials/schema";
import { authoredHitRegion, authoredHitRegionCount, emptyHitRegion } from "./hitRegions";
import { projectileDamage } from "./projectiles";
import { type Roster, fighterAt, isActive } from "./roster";
import { type Capsule, attackCapsule, capsulesIntersect, emptyCapsule, placeCapsule } from "./geometry/contactGeometry";
import { PARTICIPANT_CAPACITY } from "../input/participants";
import { max, min } from "../core/numbers";
import { surfaceLeft, surfaceRight, surfaceZAt } from "./stage";


const ORIGINAL_PROJECTILE_RADIUS = 12.0;


const body = emptyCapsule();
const strike = emptyCapsule();
const region = emptyHitRegion();

export const StrikeKind = { none: 0, normal: 1, special: 2, projectile: 3 } as const;
export type StrikeKind = (typeof StrikeKind)[keyof typeof StrikeKind];

export interface StrikeResult {
  kind: StrikeKind;
  slot: number;
  direction: number;
  style: AttackStyle | undefined;
  action: SpecialAction;
  projectile: number;
  damage: number;
}

export interface StrikeMarks {
  readonly struck: (number | undefined)[];
  specialStruck: number;
}

export function strikeResult(): StrikeResult {
  return { kind: StrikeKind.none, slot: -1, direction: 0, style: undefined, action: SpecialAction.none, projectile: -1, damage: 0.0 };
}

const ignored = strikeResult();

export function placeStrikeBody(target: Capsule, x: number, z: number, radius: number, height: number): void {
  target.x1 = x;
  target.x2 = x;
  target.z1 = f32(z + radius);
  target.z2 = f32(f32(z + height) - radius);
  target.radius = radius;
}

function placeBody(placed: Resting<PlacedObject>, spec: Readonly<SpecialPlacement>): void {
  placeStrikeBody(body, placed.x, placed.z, spec.radius, spec.height);
}


export function normalStrike(marks: StrikeMarks, target: Readonly<Capsule>, sourceSlot: number, source: Readonly<Fighter>, result: StrikeResult): boolean {
  const { attack } = source;
  const style = attack.style;
  if (style === undefined || style === AttackStyle.grab || attack.dashGrab || marks.struck[sourceSlot] === attack.serial) return false;
  const moves = source.tuning.moves;
  for (let index = 0; index < authoredHitRegionCount(style, moves); index++) {
    authoredHitRegion(region, source.character, style, attack.frame, attack.smashChargeFrames, index, moves);
    if (region.window <= 0) continue;
    attackCapsule(strike, style, region);
    placeCapsule(strike, strike, source.motion.x, source.motion.z, source.facing);
    if (!capsulesIntersect(strike, target)) continue;
    marks.struck[sourceSlot] = attack.serial;
    result.kind = StrikeKind.normal;
    result.slot = sourceSlot;
    result.direction = source.facing;
    result.style = style;
    result.action = SpecialAction.none;
    result.projectile = -1;
    result.damage = region.effect.damage;
    return true;
  }
  return false;
}


export function specialStrike(marks: StrikeMarks, target: Readonly<Capsule>, sourceSlot: number, source: Readonly<Fighter>, result: StrikeResult): boolean {
  const bit = 1 << sourceSlot;
  const move = runningHeroSpecial(source);
  if (move === undefined || source.special.frame <= 1) marks.specialStruck &= ~bit;
  if (move === undefined || (marks.specialStruck & bit) !== 0) return false;
  const frame = source.special.frame - 1;
  for (const path of move.regions ?? []) {
    if (frame < path.firstFrame || frame > path.lastFrame || path.hit.strike === undefined) continue;
    placeHeroStrike(strike, source, path.hit.strike, source.motion.x, source.motion.z);
    if (!capsulesIntersect(strike, target)) continue;
    marks.specialStruck |= bit;
    result.kind = StrikeKind.special;
    result.slot = sourceSlot;
    result.direction = source.facing;
    result.style = undefined;
    result.action = source.special.action;
    result.projectile = -1;
    result.damage = path.hit.effect.damage;
    return true;
  }
  return false;
}


export function projectileStrike(target: Readonly<Capsule>, sourceSlot: number, source: Readonly<Fighter>, from: number, result: StrikeResult): number {
  for (let index = from; index < source.projectiles.length; index++) {
    const projectile = source.projectiles[index];
    if (projectile === undefined || projectile.life <= 0) continue;
    strike.x1 = f32(projectile.x - projectile.velocityX);
    strike.z1 = f32(projectile.z - projectile.velocityZ);
    strike.x2 = projectile.x;
    strike.z2 = projectile.z;
    strike.radius = projectile.kind === ProjectileKind.hero && projectile.spec !== undefined ? projectile.spec.radius : ORIGINAL_PROJECTILE_RADIUS;
    if (!capsulesIntersect(strike, target)) continue;
    result.kind = StrikeKind.projectile;
    result.slot = sourceSlot;
    result.direction = projectile.direction;
    result.style = undefined;
    result.action = SpecialAction.none;
    result.projectile = index;
    result.damage = projectileDamage(projectile);
    return index;
  }
  return -1;
}


function placedDamage(placed: PlacedObject, sourceSlot: number, source: Fighter): number {
  const normal = normalStrike(placed, body, sourceSlot, source, ignored) ? ignored.damage : 0.0;
  const special = specialStrike(placed, body, sourceSlot, source, ignored) ? ignored.damage : 0.0;
  let projectiles = 0.0;
  for (let index = projectileStrike(body, sourceSlot, source, 0, ignored); index >= 0; index = projectileStrike(body, sourceSlot, source, index + 1, ignored)) {
    projectiles = f32(projectiles + ignored.damage);
    mutableProjectile(source, index).life = 0;
  }
  return f32(f32(normal + special) + projectiles);
}

// Wind Walk: it slips out of sight and steps away from whoever struck it, never past the end of the floor it stands on.
function windWalk(placed: PlacedObject, spec: Readonly<SpecialPlacement>, hop: number, strikerX: number, stage: number, matchFrame: number): void {
  const away = strikerX > placed.x ? -1 : strikerX < placed.x ? 1 : -placed.direction;
  placed.x = f32(placed.x + f32(away * hop));
  const surface = placed.surface;
  if (surface !== undefined) {
    placed.x = min(f32(surfaceRight(stage, surface, matchFrame) - spec.radius), max(f32(surfaceLeft(stage, surface, matchFrame) + spec.radius), placed.x));
    placed.z = surfaceZAt(stage, surface, matchFrame, placed.x);
  }
  placed.mode = CompanionMode.vanished;
  placed.modeFrame = 0;
}

function ownedProjectiles(f: Readonly<Fighter>): number {
  let count = 0;
  for (const projectile of f.projectiles) if (projectile.life > 0 && projectile.kind === ProjectileKind.hero) count++;
  return count;
}


function towardNearestFoe(world: Roster, ownerSlot: number, placed: Resting<PlacedObject>): number {
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

export function advancePlacedObjects(world: Roster, stage: number, matchFrame: number): void {
  for (let ownerSlot = 0; ownerSlot < PARTICIPANT_CAPACITY; ownerSlot++) {
    if (!isActive(world, ownerSlot)) continue;
    const owner = fighterAt(world, ownerSlot);
    for (let animal = 0; animal <= owner.pack.length; animal++) {
      const spec = placedObject(owner, animal).spec;
      if (placedObject(owner, animal).life <= 0 || spec === undefined) continue;
      const placed = mutablePlacedObject(owner, animal);
      const channeled = spec.channeled === true;
      if (channeled && runningHeroSpecial(owner)?.placement !== spec) {
        placed.life = 0;
        continue;
      }
      const crumble = spec.crumble ?? 0;
      placeBody(placed, spec);
      if (placed.mode === CompanionMode.vanished && spec.windWalk !== undefined && ++placed.modeFrame >= spec.windWalk.frames) {
        placed.mode = CompanionMode.follow;
        placed.modeFrame = 0;
      }
      for (let sourceSlot = 0; sourceSlot < PARTICIPANT_CAPACITY && placed.life > crumble && placed.mode !== CompanionMode.vanished; sourceSlot++) {
        if (!canHit(world, sourceSlot, ownerSlot) || !isActive(world, sourceSlot)) continue;
        const source = fighterAt(world, sourceSlot);
        if (source.status.out) continue;
        const damage = placedDamage(placed, sourceSlot, source);
        if (damage > 0.0 && spec.windWalk !== undefined) {
          windWalk(placed, spec, spec.windWalk.hop, source.motion.x, stage, matchFrame);
          continue;
        }
        if (!channeled) placed.durability = f32(placed.durability - damage);
        if (damage > 0.0) staggerCompanion(placed);
      }
      placed.age++;
      placed.life--;
      if (placed.durability <= 0.0 && placed.life > crumble) placed.life = crumble;
      if (placed.life <= crumble) continue;
      let scheduled = false;
      for (const age of spec.fireAges) if (age === placed.age) scheduled = true;
      const ready = placed.mode === CompanionMode.follow || spec.aura === true && placed.mode !== CompanionMode.stunned && placed.mode !== CompanionMode.vanished;
      const fires = scheduled && ready && !inGrabContext(owner) && owner.launch.hitstun <= 0 && !owner.status.out;
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
