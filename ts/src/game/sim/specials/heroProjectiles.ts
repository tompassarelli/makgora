import { sameTeam } from "../teams";
import { min } from "../../core/numbers";
import { f32 } from "wisp/src/sim/f32";
import { at } from "wisp/src/runtime/lookup";
import { ProjectileKind, SpecialAction } from "../codes";
import { mutableProjectile } from "../fighterProjectiles";
import { type Fighter, type Projectile } from "../fighter";
import { type AuthoredSpecial, type SpecialKit, type SpecialProjectile, specialForm, specialKit } from "./schema";
import { type Controls, type Roster, fighterAt, isActive } from "../roster";
import { segmentBoxesOverlap } from "../geometry/contactGeometry";
import { PARTICIPANT_CAPACITY } from "../../input/participants";
import { floorBelow, floorSurfaceBelow, mainDeckLeft, mainDeckRight, mainDeckZAt, solidSurfaceAt, solidSurfaceCount, surfaceCount, surfaceLeft, surfaceMoves, surfaceRight, surfaceZAt } from "../stage";
import type { ProjectileVelocity } from "./volleys";
import { clearBounce } from "../projectileBounce";
import { decorates, neverStrikes, ownedCount } from "./ownedProjectiles";
import { runningHeroSpecial, projectileAnchor } from "./runningMove";

export const HERO_PROJECTILE_CAP = 3;

export function recallProjectiles(f: Fighter): void {
  let index = -1;
  for (const projectile of f.projectiles) {
    index++;
    const returns = projectile.spec?.returns;
    if (projectile.life <= 0 || projectile.kind !== ProjectileKind.hero || returns === undefined || projectile.spec === undefined || projectile.damageMultiplier !== 1.0) continue;
    mutableProjectile(f, index).life = min(projectile.life, projectile.spec.life - returns.age);
  }
}

export function projectilesFit(f: Readonly<Fighter>, move: Readonly<AuthoredSpecial>): boolean {
  const projectiles = move.projectiles ?? [];
  if (projectiles.length === 0) return true;
  let threats = 0;
  for (let index = 0; index < projectiles.length; index++) if (!decorates(at(projectiles, index))) threats++;
  if (ownedCount(f, undefined) + threats > HERO_PROJECTILE_CAP) return false;
  for (let index = 0; index < projectiles.length; index++) {
    const spec = at(projectiles, index);
    if (ownedCount(f, spec) >= spec.limit) return false;
  }
  return true;
}

function segmentsCross(ax: number, az: number, bx: number, bz: number, cx: number, cz: number, dx: number, dz: number): boolean {
  if (!segmentBoxesOverlap(ax, az, bx, bz, cx, cz, dx, dz)) return false;
  const side = (px: number, pz: number, qx: number, qz: number, rx: number, rz: number): number =>
    f32(f32(f32(qx - px) * f32(rz - pz)) - f32(f32(qz - pz) * f32(rx - px)));
  const c = side(ax, az, bx, bz, cx, cz);
  const d = side(ax, az, bx, bz, dx, dz);
  const a = side(cx, cz, dx, dz, ax, az);
  const b = side(cx, cz, dx, dz, bx, bz);
  return ((c > 0 && d < 0) || (c < 0 && d > 0)) && ((a > 0 && b < 0) || (a < 0 && b > 0));
}

function clearLine(stage: number, fromX: number, fromZ: number, toX: number, toZ: number): boolean {
  for (let index = 0; index < solidSurfaceCount(stage); index++) {
    const surface = solidSurfaceAt(stage, index);
    if (segmentsCross(fromX, fromZ, toX, toZ, surface.startX, surface.startZ, surface.endX, surface.endZ)) return false;
  }
  return true;
}

function nearestFoe(world: Roster | undefined, owner: Readonly<Fighter>): Fighter | undefined {
  if (world === undefined) return undefined;
  let nearest: Fighter | undefined;
  let distance = 0.0;
  for (let slot = 0; slot < PARTICIPANT_CAPACITY; slot++) {
    if (!isActive(world, slot)) continue;
    const other = fighterAt(world, slot);
    if (other === owner || sameTeam(world, world.fighters.indexOf(owner), slot) || other.status.out) continue;
    const dx = Math.abs(f32(other.motion.x - owner.motion.x));
    if (nearest !== undefined && dx >= distance) continue;
    nearest = other;
    distance = dx;
  }
  return nearest;
}

function markX(owner: Readonly<Fighter>, spec: Readonly<SpecialProjectile>, stage: number, matchFrame: number, x: number): number {
  if (spec.ledgeInset === undefined || floorBelow(stage, matchFrame, x, owner.motion.z) !== undefined) return x;
  if (!owner.motion.grounded && floorBelow(stage, matchFrame, owner.motion.x, owner.motion.z) === undefined) return x;
  const facing = owner.facing;
  let ledge: number | undefined;
  for (let index = 0; index < surfaceCount(stage); index++) {
    const edge = facing > 0 ? surfaceRight(stage, index, matchFrame) : surfaceLeft(stage, index, matchFrame);
    const near = facing > 0 ? surfaceLeft(stage, index, matchFrame) : surfaceRight(stage, index, matchFrame);
    if (f32(f32(edge - owner.motion.x) * facing) < 0.0 || f32(f32(near - x) * facing) > 0.0) continue;
    if (surfaceZAt(stage, index, matchFrame, edge) > owner.motion.z) continue;
    if (ledge === undefined || f32(f32(edge - ledge) * facing) > 0.0) ledge = edge;
  }
  return ledge === undefined ? x : f32(ledge - f32(facing * spec.ledgeInset));
}

function markBaseZ(owner: Readonly<Fighter>, spec: Readonly<SpecialProjectile>, stage: number, matchFrame: number, x: number): number {
  if (spec.dropsToFloor !== true || owner.motion.grounded) return owner.motion.z;
  const pastLedge = runningHeroSpecial(owner)?.needsFloorBelow === true ? floorBelow(stage, matchFrame, owner.motion.x, owner.motion.z) : undefined;
  return floorBelow(stage, matchFrame, x, owner.motion.z) ?? pastLedge ?? owner.motion.z;
}

function riddenDeck(spec: Readonly<SpecialProjectile>, drawn: Readonly<Projectile> | undefined, stage: number, matchFrame: number, x: number, z: number): number | undefined {
  if (drawn !== undefined) return drawn.surface;
  if (spec.dropsToFloor !== true || !neverStrikes(spec)) return undefined;
  const surface = floorSurfaceBelow(stage, matchFrame, x, z);
  return surface !== undefined && surfaceMoves(stage, surface) && surfaceZAt(stage, surface, matchFrame, x) === z ? surface : undefined;
}

const aimedDown = (owner: Readonly<Fighter>, spec: Readonly<SpecialProjectile>): Readonly<ProjectileVelocity> | undefined => (owner.special.aimZ < 0 ? spec.downVelocity : undefined);

export function spawnHeroProjectile(owner: Fighter, spec: Readonly<SpecialProjectile>, serial: number, stage: number, matchFrame: number, world?: Roster): void {
  const drawn = projectileAnchor(owner, spec.atMark);
  if (spec.atMark !== undefined && drawn === undefined) return;
  const foe = spec.atFoe === true ? nearestFoe(world, owner) : undefined;
  const centreX = f32(f32(mainDeckLeft(stage) + mainDeckRight(stage)) * 0.5);
  const x = drawn !== undefined ? f32(drawn.x + f32(owner.facing * spec.offsetX)) : spec.atStageCentre === true ? centreX : foe !== undefined ? foe.motion.x : markX(owner, spec, stage, matchFrame, f32(owner.motion.x + f32(owner.facing * spec.offsetX)));
  const z = drawn !== undefined ? f32(drawn.z + spec.offsetZ) : spec.atStageCentre === true ? f32(mainDeckZAt(stage, x) + spec.offsetZ) : foe !== undefined ? f32(foe.motion.z + spec.offsetZ) : f32(markBaseZ(owner, spec, stage, matchFrame, x) + spec.offsetZ);
  if (spec.needsLineOfSight === true && !clearLine(stage, owner.motion.x, z, x, z)) return;
  const up = owner.special.aimZ > 0 && spec.upVelocityX !== undefined;
  const surface = riddenDeck(spec, drawn, stage, matchFrame, x, z);
  if (spec.fan === undefined) spawnHeroProjectileAt(owner, spec, x, z, owner.facing, up, serial, surface, aimedDown(owner, spec));
  else for (const velocity of spec.fan) spawnHeroProjectileAt(owner, spec, x, z, owner.facing, false, serial, surface, velocity);
}

export function spawnHeroProjectileAt(owner: Fighter, spec: Readonly<SpecialProjectile>, x: number, z: number, facing: number, up: boolean, serial: number, surface?: number, velocity?: Readonly<ProjectileVelocity>): void {
  let index = -1;
  for (const before of owner.projectiles) {
    index++;
    if (before.life > 0) continue;
    const projectile = mutableProjectile(owner, index);
    const velocityX = velocity?.velocityX ?? (up ? spec.upVelocityX ?? spec.velocityX : spec.velocityX);
    const velocityZ = velocity?.velocityZ ?? (up ? spec.upVelocityZ ?? spec.velocityZ : spec.velocityZ);
    projectile.kind = ProjectileKind.hero;
    projectile.spec = spec;
    projectile.visualFamily = owner.character;

    projectile.direction = f32(facing * velocityX) < 0 ? -1 : f32(facing * velocityX) > 0 ? 1 : facing < 0 ? -1 : 1;
    projectile.velocityX = f32(facing * velocityX);
    projectile.velocityZ = velocityZ;
    projectile.x = x;
    projectile.z = z;
    projectile.serial = serial;
    projectile.damageMultiplier = 1.0;
    projectile.newlyReflected = false;
    projectile.poolHits = 0;
    projectile.poolWait = 0;
    clearBounce(projectile);
    projectile.surface = surface;
    projectile.life = spec.life;
    return;
  }
}

export function burstProjectiles(f: Fighter, from: Readonly<SpecialProjectile>, into: Readonly<SpecialProjectile>): void {
  const specials = f.tuning.specials;
  const kit = specials === undefined || f.special.action === SpecialAction.heroUltimate ? undefined : specialKit(specials, f.special.action - SpecialAction.heroNeutral);
  const ordinary = kit === undefined ? undefined : specialForm(kit, f.special.form, f.special.variant).burst;
  let index = -1;
  for (const before of f.projectiles) {
    index++;
    if (before.life <= 0 || before.kind !== ProjectileKind.hero
      || (before.spec !== from && before.spec !== ordinary?.from)) continue;
    const projectile = mutableProjectile(f, index);
    projectile.spec = into;
    projectile.velocityX = 0.0;
    projectile.velocityZ = 0.0;
    projectile.life = into.life;
  }
}

function castMakes(move: Readonly<AuthoredSpecial> | undefined, spec: Readonly<SpecialProjectile>): boolean {
  if (move === undefined) return false;
  for (const shot of move.projectiles ?? []) if (chainHolds(shot, spec)) return true;
  return move.burst !== undefined && chainHolds(move.burst.into, spec);
}

function chainHolds(shot: Readonly<SpecialProjectile> | undefined, spec: Readonly<SpecialProjectile>): boolean {
  if (shot === undefined) return false;
  return shot === spec || chainHolds(shot.burstInto, spec) || chainHolds(shot.expiresInto, spec);
}

export function endLiveCasts(f: Fighter, kit: Readonly<SpecialKit>): void {
  let index = -1;
  for (const projectile of f.projectiles) {
    index++;
    const spec = projectile.spec;
    if (projectile.life <= 0 || projectile.kind !== ProjectileKind.hero || spec === undefined) continue;
    if (castMakes(kit.ground, spec) || castMakes(kit.air, spec)) mutableProjectile(f, index).life = 0;
  }
}

export function holdAim(f: Fighter, move: Readonly<AuthoredSpecial>, input: Readonly<Controls> | undefined, stage: number, matchFrame: number): boolean {
  const aim = move.aim;
  const rune = move.projectiles?.[0];
  if (aim === undefined || rune === undefined || input?.specialHeld !== true || f.special.frame !== aim.frame + 1) return false;
  let index = -1;
  for (const projectile of f.projectiles) {
    index++;
    if (projectile.life <= 0 || projectile.spec !== rune) continue;
    const x = f32(projectile.x + f32(f.facing * aim.speed));
    if (f32(f32(x - f.motion.x) * f.facing) > aim.reach) return false;
    const held = mutableProjectile(f, index);
    held.x = markX(f, rune, stage, matchFrame, x);
    held.life = rune.life;
    held.z = floorBelow(stage, matchFrame, held.x, f.motion.z) ?? f.motion.z;
    held.surface = riddenDeck(rune, undefined, stage, matchFrame, held.x, held.z);
    f.special.frame = aim.frame;
    f.special.lockFrames++;
    f.attack.cooldown++;
    return true;
  }
  return false;
}

export function steeredShot(f: Readonly<Fighter>): Readonly<Projectile> | undefined {
  const move = runningHeroSpecial(f);
  return move?.steersShot === undefined || f.special.frame !== move.steersShot.frame ? undefined : projectileAnchor(f, move.projectiles?.[0]);
}

export function aimedProjectile(f: Readonly<Fighter>): Readonly<Projectile> | undefined {
  const move = runningHeroSpecial(f);
  return move?.aim === undefined || f.special.frame !== move.aim.frame ? undefined : projectileAnchor(f, move.projectiles?.[0]);
}

export function agesWithMove(owner: Readonly<Fighter>, projectile: Readonly<Projectile>): boolean {
  const spec = projectile.spec;
  if (owner.launch.hitlag <= 0 || owner.special.action !== SpecialAction.heroUltimate || spec === undefined || !neverStrikes(spec)) return false;
  return runningHeroSpecial(owner)?.projectiles?.includes(spec) === true;
}
