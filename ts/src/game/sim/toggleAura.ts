import { f32 } from "wisp/src/sim/f32";
import { addFloat32, roundToFloat32 } from "wisp/src/sim/binary32";
import { floorMod } from "wisp/src/sim/intMath";
import { PARTICIPANT_CAPACITY } from "../input/participants";
import { ProjectileKind } from "./codes";
import { isIntangible } from "./conditions";
import type { Fighter, Projectile } from "./fighter";
import { mutableProjectile } from "./fighterProjectiles";
import { hurtCapsule } from "./geometry/contactGeometry";
import { capPercent } from "./percent";
import { type Roster, fighterAt, isActive } from "./roster";
import type { AuraTrail, ToggleAura } from "./specials/auraSchema";
import { spawnHeroProjectileAt } from "./specials/heroProjectiles";
import { SpecialSlot, type SpecialProjectile, specialKit } from "./specials/schema";
import { canHit } from "./teams";

export function toggleAuraOf(f: Readonly<Fighter>): ToggleAura<SpecialProjectile> | undefined {
  const specials = f.tuning.specials;
  if (specials === undefined) return undefined;
  for (let slot = SpecialSlot.neutral; slot <= SpecialSlot.down; slot++) {
    const kit = specialKit(specials, slot);
    const aura = kit.ground.toggleAura ?? kit.air?.toggleAura;
    if (aura !== undefined) return aura;
  }
  return undefined;
}

function isPatch(projectile: Readonly<Projectile>, trail: Readonly<AuraTrail<SpecialProjectile>>): boolean {
  return projectile.life > 0 && projectile.kind === ProjectileKind.hero && projectile.spec === trail.patch;
}

function trailLives(f: Readonly<Fighter>, trail: Readonly<AuraTrail<SpecialProjectile>> | undefined): boolean {
  if (trail === undefined) return false;
  for (const projectile of f.projectiles) if (isPatch(projectile, trail)) return true;
  return false;
}

export function toggleAuraOnFrame(f: Fighter, aura: Readonly<ToggleAura<SpecialProjectile>> | undefined, frame: number): void {
  if (aura?.frame !== frame) return;
  f.status.aura = !f.status.aura;
  if (!trailLives(f, aura.trail)) f.status.auraFrames = 0;
}

function wound(target: Fighter, damage: number): void {
  target.status.damage = capPercent(addFloat32(roundToFloat32(target.status.damage), damage));
}

function inCloud(owner: Readonly<Fighter>, target: Readonly<Fighter>, radius: number): boolean {
  const own = hurtCapsule(owner.character);
  const other = hurtCapsule(target.character);
  const across = f32(f32(radius + own.radius) + other.radius);
  const dz = f32(f32(target.motion.z + other.z1) - f32(owner.motion.z + own.z1));
  return Math.abs(f32(target.motion.x - owner.motion.x)) <= across && Math.abs(dz) <= across;
}

function onPatch(trail: Readonly<AuraTrail<SpecialProjectile>>, patch: Readonly<Projectile>, target: Readonly<Fighter>): boolean {
  const across = f32(trail.patch.radius + hurtCapsule(target.character).radius);
  return Math.abs(f32(target.motion.x - patch.x)) <= across && Math.abs(f32(target.motion.z - patch.z)) <= trail.patch.radius;
}

function inTrail(owner: Readonly<Fighter>, trail: Readonly<AuraTrail<SpecialProjectile>> | undefined, target: Readonly<Fighter>): boolean {
  if (trail === undefined) return false;
  for (const patch of owner.projectiles) if (isPatch(patch, trail) && onPatch(trail, patch, target)) return true;
  return false;
}

function poisonCloud(world: Roster, slot: number, owner: Readonly<Fighter>, aura: Readonly<ToggleAura<SpecialProjectile>>): void {
  for (let target = 0; target < PARTICIPANT_CAPACITY; target++) {
    if (!isActive(world, target) || !canHit(world, slot, target)) continue;
    const foe = fighterAt(world, target);
    if (foe.status.out || isIntangible(foe)) continue;
    if (!(owner.status.aura && inCloud(owner, foe, aura.radius)) && !inTrail(owner, aura.trail, foe)) continue;
    wound(foe, aura.damage);
    foe.status.struckBy = slot;
    foe.status.slowFrames = aura.slowFrames;
    foe.status.slowScale = aura.slowScale;
  }
}

function dropPatch(f: Fighter, trail: Readonly<AuraTrail<SpecialProjectile>>, clock: number): void {
  const { motion } = f;
  if (!motion.grounded) return;
  let live = 0;
  let newest: Readonly<Projectile> | undefined;
  let oldest = -1;
  let index = -1;
  for (const projectile of f.projectiles) {
    index++;
    if (!isPatch(projectile, trail)) continue;
    live++;
    if (newest === undefined || projectile.life > newest.life) newest = projectile;
    if (oldest < 0 || projectile.life < (f.projectiles[oldest]?.life ?? 0)) oldest = index;
  }
  const spaced = newest !== undefined && floorMod(clock, trail.every) === 0 && Math.abs(f32(motion.x - newest.x)) >= trail.minTravel;
  if (newest !== undefined && !spaced) return;
  if (live >= trail.limit && oldest >= 0) mutableProjectile(f, oldest).life = 0;
  spawnHeroProjectileAt(f, trail.patch, motion.x, motion.z, f.facing, false, clock, motion.surface);
}

/** While its aura is on a fighter wounds and slows foes in it and bleeds itself, and drops patches that keep wounding and slowing on the same clock after it ends; a foe takes at most one wound a tick and its slow wears off. */
export function advanceAura(world: Roster, slot: number): void {
  const f = fighterAt(world, slot);
  const { status } = f;
  if (status.slowFrames > 0) status.slowFrames--;
  if (!status.aura && status.auraFrames === 0) return;
  const aura = toggleAuraOf(f);
  if (aura === undefined) {
    status.aura = false;
    status.auraFrames = 0;
    return;
  }
  if (status.out) return;
  if (!status.aura && !trailLives(f, aura.trail)) {
    status.auraFrames = 0;
    return;
  }
  status.auraFrames++;
  if (status.aura && floorMod(status.auraFrames, aura.selfEvery) === 0) wound(f, aura.selfDamage);
  if (floorMod(status.auraFrames, aura.every) === 0) poisonCloud(world, slot, f, aura);
  if (status.aura && aura.trail !== undefined) dropPatch(f, aura.trail, status.auraFrames);
}
