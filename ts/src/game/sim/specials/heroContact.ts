import { sameTeam } from "../teams";
import { max } from "../../core/numbers";
import { f32 } from "wisp/src/sim/f32";
import { at } from "wisp/src/runtime/lookup";
import { isIntangible } from "../conditions";
import { type Fighter } from "../fighter";
import type { StrikeCapsule } from "../heroMoves";
import { type SpecialBeam } from "./schema";
import { type HitRegion, NO_HIT_REGION } from "../hitRegions";
import { type Roster, fighterAt, isActive } from "../roster";
import { capsuleCircleIntersects, shieldSizeMultiplier } from "../shield";
import { shieldCenterX, shieldCenterZ } from "../shieldTilt";
import { type Capsule, emptyCapsule, placeCapsule } from "../geometry/contactGeometry";
import { HurtContact, strikeHurtContact } from "../hurtboxes";
import { PARTICIPANT_CAPACITY } from "../../input/participants";
import { squareRoot } from "../warcraftMath";
import { runningHeroSpecial, projectileAnchor } from "./runningMove";

const BEAM_TARGET_HEIGHT = 45.0;

const beamFoe = { x: 0.0, z: 0.0 };

function findBeamFoe(world: Roster, owner: Readonly<Fighter>, beam: Readonly<SpecialBeam>, originX: number, originZ: number): boolean {
  const self = world.fighters.indexOf(owner);
  const reach = f32(beam.range * beam.range);
  let found = false;
  let nearest = 0.0;
  for (let slot = 0; slot < PARTICIPANT_CAPACITY; slot++) {
    if (!isActive(world, slot)) continue;
    const other = fighterAt(world, slot);
    if (other === owner || sameTeam(world, self, slot) || other.status.out) continue;
    const dx = f32(other.motion.x - originX);
    const z = f32(other.motion.z + BEAM_TARGET_HEIGHT);
    const dz = f32(z - originZ);
    if (f32(dx * owner.facing) < 0.0) continue;
    const squared = f32(f32(dx * dx) + f32(dz * dz));
    if (squared > reach || (found && squared >= nearest)) continue;
    found = true;
    nearest = squared;
    beamFoe.x = other.motion.x;
    beamFoe.z = z;
  }
  return found;
}

export const BEAM_MIN_AHEAD = 60.0;

function aimBeam(f: Fighter, world: Roster, beam: Readonly<SpecialBeam>, frame: number, originX: number, originZ: number): void {
  const { special } = f;
  const found = findBeamFoe(world, f, beam, originX, originZ);
  if (frame <= 1) {
    special.beamX = found ? beamFoe.x : f32(originX + f32(f.facing * beam.range));
    special.beamZ = found ? beamFoe.z : originZ;
    return;
  }
  if (!found) return;
  const dx = f32(beamFoe.x - special.beamX);
  const dz = f32(beamFoe.z - special.beamZ);
  const distance = squareRoot(f32(f32(dx * dx) + f32(dz * dz)));
  if (distance <= beam.track) {
    special.beamX = beamFoe.x;
    special.beamZ = beamFoe.z;
  } else {
    const scale = f32(beam.track / distance);
    special.beamX = f32(special.beamX + f32(dx * scale));
    special.beamZ = f32(special.beamZ + f32(dz * scale));
  }
}

function beamDirection(owner: Readonly<Fighter>, x1: number, z1: number): void {
  let dx = f32(owner.special.beamX - x1);
  let dz = f32(owner.special.beamZ - z1);
  const length = squareRoot(f32(f32(dx * dx) + f32(dz * dz)));
  if (length <= 0.0) {
    dx = owner.facing < 0 ? -1.0 : 1.0;
    dz = 0.0;
  } else {
    dx = f32(dx / length);
    dz = f32(dz / length);
  }
  beamUnit.x = dx;
  beamUnit.z = dz;
}

const beamUnit = { x: 0.0, z: 0.0 };

function shieldStop(world: Roster, owner: Readonly<Fighter>, range: number, x1: number, z1: number): number {
  const self = world.fighters.indexOf(owner);
  let stop = range;
  for (let slot = 0; slot < PARTICIPANT_CAPACITY; slot++) {
    if (!isActive(world, slot)) continue;
    const other = fighterAt(world, slot);
    if (other === owner || !other.shield.raised || sameTeam(world, self, slot) || other.status.out) continue;
    const radius = f32(other.tuning.shield.radius * shieldSizeMultiplier(other.shield.energy, other.shield.strength));
    const wx = f32(shieldCenterX(other) - x1);
    const wz = f32(shieldCenterZ(other) - z1);
    const along = f32(f32(wx * beamUnit.x) + f32(wz * beamUnit.z));
    const across = f32(f32(f32(wx * wx) + f32(wz * wz)) - f32(along * along));
    const reach = f32(radius * radius);
    if (across > reach) continue;
    const half = squareRoot(f32(reach - across));
    if (f32(along + half) < 0.0) continue;
    const entry = max(0.0, f32(along - half));
    if (entry < stop) stop = entry;
  }
  return stop;
}

export function trackBeam(f: Fighter, world: Roster, beam: Readonly<SpecialBeam>, frame: number): void {
  const { motion, special } = f;
  const originX = f32(motion.x + f32(f.facing * beam.originX));
  const originZ = f32(motion.z + beam.originZ);
  aimBeam(f, world, beam, frame, originX, originZ);
  if (f32(f32(special.beamX - originX) * f.facing) < BEAM_MIN_AHEAD) special.beamX = f32(originX + f32(f.facing * BEAM_MIN_AHEAD));
  beamDirection(f, originX, originZ);
  special.beamLength = shieldStop(world, f, beam.range, originX, originZ);
}

export function beamSegment(out: Capsule, owner: Readonly<Fighter>, beam: Readonly<SpecialBeam>, radius: number): Capsule {
  const x1 = f32(owner.motion.x + f32(owner.facing * beam.originX));
  const z1 = f32(owner.motion.z + beam.originZ);
  beamDirection(owner, x1, z1);
  out.x1 = x1;
  out.z1 = z1;
  out.x2 = f32(x1 + f32(beamUnit.x * owner.special.beamLength));
  out.z2 = f32(z1 + f32(beamUnit.z * owner.special.beamLength));
  out.radius = radius;
  return out;
}

export function placeHeroStrike(out: Capsule, owner: Readonly<Fighter>, path: Readonly<StrikeCapsule>, originX: number, originZ: number): Capsule {
  const beam = runningHeroSpecial(owner)?.beam;
  if (beam !== undefined) return beamSegment(out, owner, beam, path.radius);
  placeCapsule(out, path, originX, originZ, owner.facing);
  if (path.path === true) {
    out.x1 = f32(out.x1 - owner.motion.deltaX);
    out.z1 = f32(out.z1 - owner.motion.deltaZ);
  }
  return out;
}

export const strike = emptyCapsule();

export function heroRegionOrigin(owner: Readonly<Fighter>): { readonly x: number; readonly z: number } {
  return projectileAnchor(owner, runningHeroSpecial(owner)?.regionOrigin) ?? owner.motion;
}

export function heroStrikeMeetsShield(owner: Readonly<Fighter>, target: Readonly<Fighter>, region: Readonly<HitRegion>): boolean {
  const path = region.strike;
  if (!target.shield.raised || path === undefined) return false;
  const origin = heroRegionOrigin(owner);
  placeHeroStrike(strike, owner, path, origin.x, origin.z);
  const geometry = target.tuning.shield;
  return capsuleCircleIntersects(strike.x1, strike.z1, strike.x2, strike.z2, strike.radius,
    shieldCenterX(target), shieldCenterZ(target), geometry.radius,
    shieldSizeMultiplier(target.shield.energy, target.shield.strength));
}

export function heroSpecialContact(owner: Readonly<Fighter>, target: Readonly<Fighter>, alreadyHit: boolean): Readonly<HitRegion> {
  const move = runningHeroSpecial(owner);
  if (move === undefined || alreadyHit || owner.launch.hitlag > 0 || target.status.out || isIntangible(target)) return NO_HIT_REGION;
  const regions = move.regions ?? [];
  const anchor = projectileAnchor(owner, move.regionOrigin);
  if (move.regionOrigin !== undefined && anchor === undefined) return NO_HIT_REGION;
  const origin = anchor ?? owner.motion;
  const frame = owner.special.frame - 1;
  for (let index = 0; index < regions.length; index++) {
    const region = at(regions, index);
    if (frame < region.firstFrame || frame > region.lastFrame || region.hit.strike === undefined) continue;
    placeHeroStrike(strike, owner, region.hit.strike, origin.x, origin.z);
    const contact = strikeHurtContact(strike, target);
    if (contact === HurtContact.hit || heroStrikeMeetsShield(owner, target, region.hit)) return region.hit;
    if (contact === HurtContact.invincible) return NO_HIT_REGION;
  }
  return NO_HIT_REGION;
}
