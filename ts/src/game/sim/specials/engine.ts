import { sameTeam } from "../teams";
import { chargeBanked, chargeHolds, chargeSwingFloor } from "./charge";
import { releaseCommandGrabLock } from "./commandGrabLock";
import { changesAimZone, chargedAimX, chargedAimZ, steerAim, stepSide } from "./aimZone";




import { max, min } from "../../core/numbers";
import { f32 } from "wisp/src/sim/f32";
import { at } from "wisp/src/runtime/lookup";
import { applyItemBuffFor } from "../itemBuffs";
import { advanceHeroConditions, cleansePoisonAndSlow } from "../heroStatus";
import { Character, ProjectileKind, SpecialAction } from "../codes";
import { openParasol } from "../parasol";
import { specialVariant } from "../../fighters/kobold/candle";
import { mutableProjectile } from "../fighterProjectiles";
import { canAttack, inGrabContext, isIntangible } from "../conditions";
import { type Fighter, type Projectile, mutablePlacedObject, placedObject } from "../fighter";
import type { StrikeCapsule } from "../heroMoves";
import { type FighterSpecials, type AuthoredSpecial, type FrameWindow, CompanionMode, CompanionOrder, type SpecialCharge, type SpecialFollowUp, type SpecialKit, type SpecialArmor, type SpecialBeam, type SpecialMotion, type SpecialPlacement, type SpecialProjectile, type SpecialSteer, type SpecialSteeredShot, type SpecialEgg, FOLLOW_UP_FORM, FollowUpInput, Relocation, SpecialForm, SpecialSlot, chargeStage, specialForm, specialKit, ultimateForm } from "./schema";
import { airCastVariant, castFloating, floatsNow, stallAir } from "./airFloat";
import { advanceRefire } from "./refire";
import { type HitRegion, NO_HIT_REGION } from "../hitRegions";
import { type Controls, type Roster, fighterAt, isActive } from "../roster";
import { travelBeforeBodies } from "../travelStop";
import { gainUltimate, ultimatePercent } from "../meter";
import { endDivineShield, refreshAirOnExit } from "../transitions";
import { capsuleCircleIntersects, shieldSizeMultiplier } from "../shield";
import { shieldCenterX, shieldCenterZ } from "../shieldTilt";
import { type Capsule, emptyCapsule, placeCapsule, segmentBoxesOverlap } from "../geometry/contactGeometry";
import { HurtContact, strikeHurtContact } from "../hurtboxes";
import { PARTICIPANT_CAPACITY } from "../../input/participants";
import { specialPlacements } from "./placements";
import { floorBelow, floorSurfaceBelow, mainDeckLeft, mainDeckRight, mainDeckZAt, solidSurfaceAt, solidSurfaceCount, surfaceCount, surfaceLeft, surfaceMoves, surfaceRight, surfaceZAt } from "../stage";
import { clearMotionValue, setWorldMotionValue } from "../motion";
import { currentTraits } from "../identityTraits";
import { squareRoot } from "../warcraftMath";


const DIAGONAL = 0.7071067690849304;

export const HERO_PROJECTILE_CAP = 3;

export const isHeroSpecialAction = (action: number): boolean => action >= SpecialAction.heroNeutral && action <= SpecialAction.heroUltimate;



export function runningHeroSpecial(f: Readonly<Fighter>): AuthoredSpecial | undefined {
  if (f.special.action === SpecialAction.heroUltimate) {
    const ultimate = f.tuning.ultimate;
    return ultimate === undefined ? undefined : ultimateForm(ultimate, f.special.form);
  }
  const specials = f.tuning.specials;
  if (specials === undefined || !isHeroSpecialAction(f.special.action)) return undefined;
  return specialForm(specialKit(specials, f.special.action - SpecialAction.heroNeutral), f.special.form, f.special.ex, f.special.variant);
}

function requestedSlot(input: Readonly<Controls>): SpecialSlot {
  return input.specialZ > 0 ? SpecialSlot.up : input.specialZ < 0 ? SpecialSlot.down : input.specialX !== 0 ? SpecialSlot.side : SpecialSlot.neutral;
}

function ownedCount(f: Readonly<Fighter>, spec: Readonly<SpecialProjectile> | undefined): number {
  let count = 0;
  for (const projectile of f.projectiles) {
    if (projectile.life > 0 && projectile.kind === ProjectileKind.hero && (spec === undefined || projectile.spec === spec)) count++;
  }
  return count;
}




function recallProjectiles(f: Fighter): void {
  let index = -1;
  for (const projectile of f.projectiles) {
    index++;
    const returns = projectile.spec?.returns;
    if (projectile.life <= 0 || projectile.kind !== ProjectileKind.hero || returns === undefined || projectile.spec === undefined || projectile.damageMultiplier !== 1.0) continue;
    mutableProjectile(f, index).life = min(projectile.life, projectile.spec.life - returns.age);
  }
}


function projectilesFit(f: Readonly<Fighter>, move: Readonly<AuthoredSpecial>): boolean {
  const projectiles = move.projectiles ?? [];
  if (projectiles.length === 0) return true;
  if (ownedCount(f, undefined) + projectiles.length > HERO_PROJECTILE_CAP) return false;
  for (let index = 0; index < projectiles.length; index++) {
    const spec = at(projectiles, index);
    const upgraded = move.ex?.projectiles?.[index];
    const exCount = upgraded === undefined || upgraded === spec ? 0 : ownedCount(f, upgraded);
    if (ownedCount(f, spec) + exCount >= spec.limit) return false;
  }
  return true;
}


function recallHolds(f: Readonly<Fighter>, kit: Readonly<SpecialKit>): boolean {
  if (kit.recallWhile === "armor") return f.status.armorFrames > 0;
  if (kit.recallWhile === "projectile") {
    const spec = kit.ground.projectiles?.[0];
    const exSpec = kit.ground.ex?.projectiles?.[0];
    return (spec !== undefined && ownedCount(f, spec) > 0) || (exSpec !== undefined && ownedCount(f, exSpec) > 0);
  }
  return (kit.recallGroundOnly !== true || f.motion.grounded) && placedObject(f, kit.ground.placement?.slot).life > 0;
}


export interface SpecialRefusal {
  groundOnly: boolean;
}

export interface HeroSpecialChoice {
  slot: SpecialSlot;
  form: SpecialForm;
  variant: number;
}


const choice: HeroSpecialChoice = { slot: SpecialSlot.neutral, form: SpecialForm.ground, variant: 0 };





export function chooseHeroSpecial(f: Readonly<Fighter>, specials: Readonly<FighterSpecials>, input: Readonly<Controls>, out: SpecialRefusal, world?: Roster): HeroSpecialChoice | undefined {
  out.groundOnly = false;
  const slot = requestedSlot(input);
  if ((f.special.cooldowns[SpecialAction.heroNeutral + slot] ?? 0) > 0) return undefined;
  const kit = specialKit(specials, slot);
  const airborne = !f.motion.grounded;
  const recalls = kit.recall !== undefined && recallHolds(f, kit);
  const form: SpecialForm = recalls ? SpecialForm.recall : airborne && kit.air !== undefined ? SpecialForm.air : SpecialForm.ground;
  const variant = specialVariant(f);
  const move = specialForm(kit, form, false, variant);
  if (move.groundOnly === true && airborne) {
    out.groundOnly = true;
    return undefined;
  }
  if (move.armor?.shell === true && f.status.armorFrames > 0) return undefined;
  if (move.oncePerAirtime === true && airborne && (f.special.airtimeUses & (1 << slot)) !== 0) return undefined;
  if (move.command?.order === CompanionOrder.lunge && !companionReady(f, move.command.slot)) return undefined;
  if (!projectilesFit(f, move)) return undefined;
  choice.slot = slot;
  choice.form = form;
  choice.variant = variant;
  return choice;
}


export function resetSpecialOnStock(f: Fighter): void {
  f.special.airtimeUses = 0;
}


export function steerHeroSpecial(f: Fighter, input: Readonly<Controls>): void {
  const move = runningHeroSpecial(f);
  if (move?.aimFrames === undefined || f.special.frame >= move.aimFrames) return;
  steerAim(f.special, move, input);
}


export function enterHeroSpecial(f: Fighter, chosen: Readonly<HeroSpecialChoice>, input: Readonly<Controls>): AuthoredSpecial {
  const specials = f.tuning.specials;
  if (specials === undefined) throw new Error("hero special without a kit");
  const move = specialForm(specialKit(specials, chosen.slot), chosen.form, f.special.ex, chosen.variant);
  const { special } = f;
  endDivineShield(f);
  special.form = chosen.form;
  special.variant = chosen.variant;
  special.grabFrame = 0;
  const aimX = input.specialX !== 0 ? input.specialX : input.direction;
  const aimZ = input.specialZ !== 0 ? input.specialZ : input.verticalDirection;
  special.aimX = aimX < 0 ? -1 : aimX > 0 ? 1 : 0;
  special.aimZ = aimZ < 0 ? -1 : aimZ > 0 ? 1 : 0;
  for (let entry = 0; entry < PARTICIPANT_CAPACITY; entry++) special.hitTargets[entry] = undefined;
  special.hit = false;
  special.guarded = false;
  special.seekTarget = 0;
  special.cooldowns[SpecialAction.heroNeutral + chosen.slot] = move.cooldownFrames ?? 0;
  if (move.replacesLive === true) endLiveCasts(f, specialKit(specials, chosen.slot));
  if (move.oncePerAirtime === true) special.airtimeUses |= 1 << chosen.slot;
  if (move.recallsProjectiles === true) recallProjectiles(f);
  if (move.charge?.drops === true) special.charge = 0;
  applyWindows(f, move, 0);
  swingFullCharge(f, move);
  return move;
}

function swingFullCharge(f: Fighter, move: Readonly<AuthoredSpecial>): void {
  const charge = move.charge;
  const followUps = move.followUps;
  if (charge === undefined || followUps === undefined || f.special.charge < chargeSwingFloor(charge)) return;
  const stage = chargeStage(charge, f.special.charge);
  for (let index = 0; index < followUps.length; index++) {
    const followUp = at(followUps, index);
    if (followUp.chargeStage !== stage) continue;
    f.special.form += FOLLOW_UP_FORM * (index + 1);
    enterFollowUp(f, followUp.special);
    return;
  }
}

function holdCharge(f: Fighter, charge: Readonly<SpecialCharge> | undefined): boolean {
  const { special } = f;
  if (charge === undefined || special.form >= FOLLOW_UP_FORM || special.frame !== charge.hold + 1 || !chargeHolds(charge, special.charge)) return false;
  special.charge = chargeBanked(charge, special.charge);
  special.frame = charge.hold;
  special.lockFrames++;
  f.attack.cooldown++;
  return true;
}

function throwFullDroppingCharge(f: Fighter, move: Readonly<AuthoredSpecial>): boolean {
  const charge = move.charge;
  if (charge?.drops !== true || f.special.form >= FOLLOW_UP_FORM || f.special.frame !== charge.hold + 1 || f.special.charge < charge.full) return false;
  swingFullCharge(f, move);
  return f.special.form >= FOLLOW_UP_FORM;
}

function chargeStageOpen(f: Readonly<Fighter>, charge: Readonly<SpecialCharge> | undefined, followUp: Readonly<SpecialFollowUp>): boolean {
  return followUp.chargeStage === undefined || (charge !== undefined && chargeStage(charge, f.special.charge) === followUp.chargeStage);
}

const inWindow = (window: { readonly first: number; readonly last: number } | undefined, frame: number): boolean =>
  window !== undefined && frame >= window.first && frame <= window.last;





export function prepareBansheeContacts(f: Fighter): void {
  if (f.character !== Character.sylvanas || f.special.action !== SpecialAction.heroUltimate || f.launch.hitlag > 0) return;
  followUpOnContact(f);
  const move = runningHeroSpecial(f);
  if (move !== undefined && inWindow(move.intangible, f.special.frame + 1)) f.status.invincible = max(f.status.invincible, 1);
}

function applyWindows(f: Fighter, move: Readonly<AuthoredSpecial>, frame: number): void {
  const { status } = f;
  if (f.character === Character.sylvanas && f.special.action === SpecialAction.heroUltimate) {
    if (inWindow(move.intangible, frame)) status.invincible = max(status.invincible, 1);
  } else if (inWindow(move.intangible, frame + 1)) status.invincible = max(status.invincible, 2);
  else if (inWindow(move.intangible, frame)) status.invincible = max(status.invincible, 1);
  if (move.armor !== undefined) applyArmorWindow(f, move.armor, frame);
}

function applyArmorWindow(f: Fighter, armor: SpecialArmor, frame: number): void {
  const { status } = f;
  if (armor.shell === true) {
    if (frame + 1 !== armor.first) return;
    status.armorFrames = armor.last - armor.first + 2;
    status.armorChills = armor.chillsStriker === true && currentTraits(f).status === true;
  } else if (inWindow(armor, frame)) {
    status.armorFrames = max(status.armorFrames, 2);
    status.armorChills = false;
  } else return;
  status.armorMaxDamage = armor.maxDamage ?? 0.0;
  status.armorKnockback = armor.knockback ?? 0.0;
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

function neverStrikes(spec: Readonly<SpecialProjectile>): boolean {
  return (spec.activeFrom ?? 0) > spec.life;
}

function riddenDeck(spec: Readonly<SpecialProjectile>, drawn: Readonly<Projectile> | undefined, stage: number, matchFrame: number, x: number, z: number): number | undefined {
  if (drawn !== undefined) return drawn.surface;
  if (spec.dropsToFloor !== true || !neverStrikes(spec)) return undefined;
  const surface = floorSurfaceBelow(stage, matchFrame, x, z);
  return surface !== undefined && surfaceMoves(stage, surface) && surfaceZAt(stage, surface, matchFrame, x) === z ? surface : undefined;
}

function projectileAnchor(owner: Readonly<Fighter>, spec: Readonly<SpecialProjectile> | undefined): Readonly<Projectile> | undefined {
  if (spec === undefined) return undefined;
  for (const projectile of owner.projectiles) if (projectile.life > 0 && projectile.spec === spec) return projectile;
  return undefined;
}

function spawnHeroProjectile(owner: Fighter, spec: Readonly<SpecialProjectile>, serial: number, stage: number, matchFrame: number, world?: Roster): void {
  const drawn = projectileAnchor(owner, spec.atMark);
  if (spec.atMark !== undefined && drawn === undefined) return;
  const foe = spec.atFoe === true ? nearestFoe(world, owner) : undefined;
  const centreX = f32(f32(mainDeckLeft(stage) + mainDeckRight(stage)) * 0.5);
  const x = drawn !== undefined ? f32(drawn.x + f32(owner.facing * spec.offsetX)) : spec.atStageCentre === true ? centreX : foe !== undefined ? foe.motion.x : markX(owner, spec, stage, matchFrame, f32(owner.motion.x + f32(owner.facing * spec.offsetX)));
  const z = drawn !== undefined ? f32(drawn.z + spec.offsetZ) : spec.atStageCentre === true ? f32(mainDeckZAt(stage, x) + spec.offsetZ) : foe !== undefined ? f32(foe.motion.z + spec.offsetZ) : f32(markBaseZ(owner, spec, stage, matchFrame, x) + spec.offsetZ);
  if (spec.needsLineOfSight === true && !clearLine(stage, owner.motion.x, z, x, z)) return;
  const up = owner.special.aimZ > 0 && spec.upVelocityX !== undefined;
  spawnHeroProjectileAt(owner, spec, x, z, owner.facing, up, serial, riddenDeck(spec, drawn, stage, matchFrame, x, z));
}


export function spawnHeroProjectileAt(owner: Fighter, spec: Readonly<SpecialProjectile>, x: number, z: number, facing: number, up: boolean, serial: number, surface?: number): void {
  let index = -1;
  for (const before of owner.projectiles) {
    index++;
    if (before.life > 0) continue;
    const projectile = mutableProjectile(owner, index);
    const velocityX = up ? spec.upVelocityX ?? spec.velocityX : spec.velocityX;
    const velocityZ = up ? spec.upVelocityZ ?? spec.velocityZ : spec.velocityZ;
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
    projectile.exReach = false;
    projectile.poolHits = 0;
    projectile.poolWait = 0;
    projectile.surface = surface;
    projectile.life = spec.life;
    return;
  }
}

export function seekTargetSlot(world: Roster, owner: Readonly<Fighter>): number {
  let nearest = -1;
  let distance = 0.0;
  for (let slot = 0; slot < PARTICIPANT_CAPACITY; slot++) {
    if (!isActive(world, slot)) continue;
    const other = fighterAt(world, slot);
    if (other === owner || sameTeam(world, world.fighters.indexOf(owner), slot) || other.status.out) continue;
    const dx = f32(other.motion.x - owner.motion.x);
    const dz = f32(other.motion.z - owner.motion.z);
    const squared = f32(f32(dx * dx) + f32(dz * dz));
    if (nearest >= 0 && squared >= distance) continue;
    nearest = slot;
    distance = squared;
  }
  return nearest;
}


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

function trackBeam(f: Fighter, world: Roster, beam: Readonly<SpecialBeam>, frame: number): void {
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


function seeks(move: Readonly<AuthoredSpecial>): boolean {
  for (const segment of move.motion ?? []) if (segment.seek !== undefined) return true;
  return false;
}


const turned = { x: 0.0, z: 0.0 };

function turnHeading(headingX: number, headingZ: number, wantX: number, wantZ: number, turnCos: number, turnSin: number, facing: number): void {
  const dot = f32(f32(headingX * wantX) + f32(headingZ * wantZ));
  if (dot >= turnCos) {
    turned.x = wantX;
    turned.z = wantZ;
    return;
  }
  const cross = f32(f32(headingX * wantZ) - f32(headingZ * wantX));
  const sine = cross > 0.0 || (cross === 0.0 && (headingX !== 0.0 ? headingX > 0.0 : facing > 0)) ? turnSin : -turnSin;
  const turnedX = f32(f32(headingX * turnCos) - f32(headingZ * sine));
  const turnedZ = f32(f32(headingZ * turnCos) + f32(headingX * sine));
  const length = squareRoot(f32(f32(turnedX * turnedX) + f32(turnedZ * turnedZ)));
  turned.x = f32(turnedX / length);
  turned.z = f32(turnedZ / length);
}


function launchHeading(f: Readonly<Fighter>): void {
  const { aimX, aimZ } = f.special;
  const diagonal = aimX !== 0 && aimZ !== 0;
  turned.x = diagonal ? f32(aimX * DIAGONAL) : aimX;
  turned.z = aimX === 0 && aimZ === 0 ? 1.0 : diagonal ? f32(aimZ * DIAGONAL) : aimZ;
}


function steeredHeading(f: Readonly<Fighter>, steer: Readonly<SpecialSteer>, length: number, input: Readonly<Controls> | undefined): void {
  const headingX = length > 0.0 ? f32(f.motion.vx / length) : 0.0;
  const headingZ = length > 0.0 ? f32(f.motion.vz / length) : 1.0;
  turned.x = headingX;
  turned.z = headingZ;
  if (input === undefined) return;
  const stickX = input.diStickValid ? input.diStickX : input.direction;
  const stickZ = input.diStickValid ? input.diStickZ : input.verticalDirection;
  const stick = squareRoot(f32(f32(stickX * stickX) + f32(stickZ * stickZ)));
  if (stick > 0.0) turnHeading(headingX, headingZ, f32(stickX / stick), f32(stickZ / stick), steer.turnCos, steer.turnSin, f.facing);
}


function steerFlight(f: Fighter, steer: Readonly<SpecialSteer>, launching: boolean, input: Readonly<Controls> | undefined): void {
  const { motion } = f;
  const length = squareRoot(f32(f32(motion.vx * motion.vx) + f32(motion.vz * motion.vz)));
  if (launching) launchHeading(f);
  else steeredHeading(f, steer, length, input);
  const speed = launching ? steer.launchSpeed : min(steer.speed, f32(length + steer.acceleration));
  motion.vx = f32(turned.x * speed);
  motion.vz = f32(turned.z * speed);
  if (motion.vx !== 0.0) f.facing = motion.vx < 0 ? -1 : 1;
}


export function steeredFlightLeft(f: Readonly<Fighter>): number {
  if (f.special.action === SpecialAction.none) return 0.0;
  const move = runningHeroSpecial(f);
  const frame = f.special.frame;
  for (const segment of move?.motion ?? []) {
    if (segment.steer === undefined) continue;
    if (frame < segment.first) return 1.0;
    return frame > segment.last ? 0.0 : f32((segment.last - frame + 1) / (segment.last - segment.first + 1));
  }
  return 0.0;
}


function seekFoe(f: Fighter, world: Roster, speed: number, turnCos: number, turnSin: number): void {
  const { motion, special } = f;
  if (special.seekTarget === 0) special.seekTarget = seekTargetSlot(world, f) + 1;
  const slot = special.seekTarget - 1;
  const foe = slot >= 0 && isActive(world, slot) ? fighterAt(world, slot) : undefined;
  let headingX = motion.vx;
  let headingZ = motion.vz;
  const length = squareRoot(f32(f32(headingX * headingX) + f32(headingZ * headingZ)));
  const towardX = foe === undefined || foe.status.out ? 0.0 : f32(foe.motion.x - motion.x);
  const towardZ = foe === undefined || foe.status.out ? 0.0 : f32(foe.motion.z - motion.z);
  const toward = squareRoot(f32(f32(towardX * towardX) + f32(towardZ * towardZ)));
  if (length <= 0.0) {
    if (toward <= 0.0) {
      headingX = f.facing < 0 ? -1.0 : 1.0;
      headingZ = 0.0;
    } else {
      headingX = f32(towardX / toward);
      headingZ = f32(towardZ / toward);
    }
  } else {
    headingX = f32(headingX / length);
    headingZ = f32(headingZ / length);
    if (toward > 0.0) {
      turnHeading(headingX, headingZ, f32(towardX / toward), f32(towardZ / toward), turnCos, turnSin, f.facing);
      headingX = turned.x;
      headingZ = turned.z;
    }
  }
  motion.vx = f32(headingX * speed);
  motion.vz = f32(headingZ * speed);
  if (motion.vx !== 0.0) f.facing = motion.vx < 0 ? -1 : 1;
}


/** Whether the running move flies through platforms this frame. */
export function heroMotionPassesPlatforms(f: Readonly<Fighter>): boolean {
  if (f.special.action === SpecialAction.none) return false;
  const move = runningHeroSpecial(f);
  if (move === undefined) return false;
  for (const segment of move.motion ?? []) if (segment.seek !== undefined && f.special.frame >= segment.first && f.special.frame <= segment.last) return true;
  return false;
}

function faceStruck(f: Fighter, world: Roster): void {
  const slot = f.special.hitTargets[0];
  if (!f.special.hit || slot === undefined || !isActive(world, slot)) return;
  const gap = f32(fighterAt(world, slot).motion.x - f.motion.x);
  if (gap !== 0.0) f.facing = gap < 0 ? -1 : 1;
}

function fallsFreely(f: Readonly<Fighter>, move: Readonly<AuthoredSpecial>, frame: number): boolean {
  return move.jumpWindow !== undefined && !f.motion.grounded && frame >= move.jumpWindow.first;
}

export function heroSpecialJumps(f: Readonly<Fighter>): boolean {
  if (!isHeroSpecialAction(f.special.action)) return false;
  const move = runningHeroSpecial(f);
  return move !== undefined && f.launch.hitlag <= 0 && inWindow(move.jumpWindow, f.special.frame) && !castFloating(f, move);
}

export function heroFloats(f: Readonly<Fighter>): boolean {
  const move = runningHeroSpecial(f);
  return move !== undefined && floatsNow(f, move);
}

function applyMotion(f: Fighter, move: Readonly<AuthoredSpecial>, frame: number, input: Readonly<Controls> | undefined, world: Roster | undefined): void {
  const { motion, special } = f;
  holdHoveringUltimate(f);
  if (special.grabFrame > 0 && move.commandGrab !== undefined) return;
  if (!ultimateHovers(f) && fallsFreely(f, move, frame)) return;
  for (const segment of move.motion ?? []) {
    if (frame < segment.first || frame > segment.last) continue;
    let velocityX = f32(stepSide(f, move) * segment.velocityX);
    let velocityZ = segment.velocityZ;
    if (segment.aimedSpeed !== undefined && (special.aimX !== 0 || special.aimZ !== 0)) {
      const scale = special.aimX !== 0 && special.aimZ !== 0 ? f32(segment.aimedSpeed * DIAGONAL) : segment.aimedSpeed;
      velocityX = f32(special.aimX * scale);
      velocityZ = f32(special.aimZ * scale);
    } else if (segment.aimedTilt !== undefined && special.aimZ !== 0) {
      velocityX = f32(velocityX * segment.aimedTilt.x);
      velocityZ = f32(f32(special.aimZ * Math.abs(segment.velocityX)) * segment.aimedTilt.z);
    }
    if (segment.driftSpeed !== undefined && input !== undefined) {
      const stick = input.diStickValid ? input.diStickX : input.direction;
      velocityX = f32(velocityX + f32(min(1.0, max(-1.0, stick)) * segment.driftSpeed));
    }
    if (segment.liftSpeed !== undefined && input !== undefined) {
      const stick = input.diStickValid ? input.diStickZ : input.verticalDirection;
      velocityZ = f32(velocityZ + f32(min(1.0, max(-1.0, stick)) * segment.liftSpeed));
    }
    if (segment.steer !== undefined) {
      steerFlight(f, segment.steer, frame === segment.first, input);
      velocityX = motion.vx;
      velocityZ = motion.vz;
    }
    if (segment.seek !== undefined && world !== undefined) {
      seekFoe(f, world, segment.seek.speed, segment.seek.turnCos, segment.seek.turnSin);
      velocityX = motion.vx;
      velocityZ = motion.vz;
    }
    motion.vx = velocityX;
    motion.vz = velocityZ;
    if (segment.facesStruck === true && frame === segment.first && world !== undefined) faceStruck(f, world);
    if (velocityZ > 0 && motion.grounded) {
      motion.grounded = false;
      motion.surface = undefined;
    }
  }
}


export function companionReady(f: Readonly<Fighter>, slot = 0): boolean {
  const placed = placedObject(f, slot);
  return placed.life > 0 && placed.spec?.companion !== undefined && (placed.mode === CompanionMode.follow || placed.mode === CompanionMode.returning);
}


function orderCompanion(f: Fighter, order: CompanionOrder, slot = 0): void {
  if (placedObject(f, slot).life <= 0 || placedObject(f, slot).spec?.companion === undefined) return;
  const placed = mutablePlacedObject(f, slot);
  if (order === CompanionOrder.lunge) {
    if (!companionReady(f, slot)) return;
    placed.mode = CompanionMode.lunge;
    placed.direction = f.facing < 0 ? -1 : 1;
    placed.bitten = 0;
    placed.modeFrame = 0;
  } else if (placed.mode !== CompanionMode.stunned) {
    placed.mode = CompanionMode.returning;
    placed.modeFrame = 0;
  }
}


function placeObjects(f: Fighter, spec: Readonly<SpecialPlacement>, frame: number, stage: number, matchFrame: number): void {
  const spread = spec.spread;
  if (spread === undefined) {
    if (spec.frame !== frame) return;
    if (spec.atMark !== undefined) {
      placeOnMark(f, spec, spec.atMark, stage, matchFrame);
      return;
    }
    placeOne(f, spec, spec.slot ?? 0, 1, spec.offsetX, undefined);
    if (spec.outwardPair === true) placeOne(f, spec, (spec.slot ?? 0) + 1, -1, spec.offsetX, undefined);
    return;
  }
  for (let index = 0; index < spread.offsets.length; index++) {
    if (spec.frame + index * spread.every === frame) placeOne(f, spec, (spec.slot ?? 0) + index, 1, at(spread.offsets, index), stage);
  }
}

function placeOnMark(f: Fighter, spec: Readonly<SpecialPlacement>, mark: Readonly<SpecialProjectile>, stage: number, matchFrame: number): void {
  const drawn = projectileAnchor(f, mark);
  if (drawn === undefined) return;
  const surface = floorSurfaceBelow(stage, matchFrame, drawn.x, f32(drawn.z + spec.height));
  if (surface === undefined) return;
  const slot = spec.slot ?? 0;
  placeOne(f, spec, slot, 1, 0.0, undefined);
  const placed = mutablePlacedObject(f, slot);
  placed.x = drawn.x;
  placed.z = surfaceZAt(stage, surface, matchFrame, drawn.x);
  placed.surface = surface;
  placed.mode = CompanionMode.stunned;
}

export function placeOne(f: Fighter, spec: Readonly<SpecialPlacement>, slot: number, side: number, offsetX: number, deckStage: number | undefined): void {
  if (spec.keepExisting === true && placedObject(f, slot).life > 0) return;
  const placed = mutablePlacedObject(f, slot);
  const facing = f.facing < 0 ? -1 : 1;
  placed.life = spec.life;
  placed.age = 0;
  placed.x = f32(f.motion.x + f32(f32(f.facing * side) * offsetX));
  placed.z = f32(f.motion.z + (spec.offsetZ ?? 0.0));
  if (deckStage !== undefined) {
    placed.x = min(f32(mainDeckRight(deckStage) - spec.radius), max(f32(mainDeckLeft(deckStage) + spec.radius), placed.x));
    placed.z = mainDeckZAt(deckStage, placed.x);
  }
  placed.direction = spec.outwardPair === true ? facing * side : facing;
  if (spec.mark !== undefined) spawnHeroProjectileAt(f, spec.mark, placed.x, f32(placed.z + spec.mark.offsetZ), placed.direction, false, f.attack.serial + 1);
  placed.durability = spec.durability;
  placed.serial++;
  placed.spec = spec;
  for (let slot = 0; slot < PARTICIPANT_CAPACITY; slot++) placed.struck[slot] = undefined;
  placed.specialStruck = 0;
  placed.mode = CompanionMode.follow;
  placed.modeFrame = 0;
  placed.apart = 0;
  placed.bitten = 0;
  placed.surface = f.motion.surface;
}






/** The first frame an ultimate can strike: a region, a striking projectile or summon, a grab or a guard. */
export function firstThreat(move: Readonly<AuthoredSpecial>): number {
  let first = move.endFrame;
  for (const region of move.regions ?? []) first = min(first, region.firstFrame + 1);
  for (const shot of move.projectiles ?? []) if (shot.effect.damage > 0.0 || shot.expiresInto !== undefined) first = min(first, shot.spawnFrame + (shot.expiresInto !== undefined && shot.effect.damage === 0.0 ? shot.life : 0));
  for (const placement of specialPlacements(move)) first = min(first, placement.frame + (placement.fireAges[0] ?? 0));
  if (move.commandGrab !== undefined) first = min(first, move.commandGrab.first);
  if (move.guard !== undefined) first = move.guard.last;
  return first;
}

export function airHoldEnd(move: Readonly<AuthoredSpecial>): number {
  return move.airHoldFrames ?? firstThreat(move);
}

function ultimateHovers(f: Readonly<Fighter>): boolean {
  const move = f.special.action === SpecialAction.heroUltimate && f.special.form < FOLLOW_UP_FORM ? f.tuning.ultimate : undefined;
  return move !== undefined && move.groundOnly !== true && !f.motion.grounded && f.special.frame < airHoldEnd(move);
}

export function holdHoveringUltimate(f: Fighter): void {
  if (!ultimateHovers(f)) return;
  f.motion.vx = 0.0;
  f.motion.vz = 0.0;
}


export function heroMotionHolds(f: Readonly<Fighter>): boolean {
  const move = runningHeroSpecial(f);
  if (move === undefined) return false;
  if (ultimateHovers(f)) return true;
  if (fallsFreely(f, move, f.special.frame)) return false;
  if (move.steersShot?.frame === f.special.frame) return true;
  for (const segment of move.motion ?? []) if (f.special.frame >= segment.first && f.special.frame <= segment.last) return true;
  return false;
}


export function hatchesOnHit(f: Readonly<Fighter>): boolean {
  if (!isHeroSpecialAction(f.special.action)) return false;
  const egg = runningHeroSpecial(f)?.egg;
  return egg !== undefined && inWindow(egg.window, f.special.frame);
}


export function becomeEgg(f: Fighter): void {
  f.special.egg = true;
  f.special.fall = true;
  f.jump.remaining = 0;
  f.motion.fastFalling = false;
}


export function heroEgg(f: Readonly<Fighter>): SpecialEgg | undefined {
  const specials = f.tuning.specials;
  if (!f.special.egg || specials === undefined) return undefined;
  for (let slot = 0; slot <= SpecialSlot.down; slot++) {
    const kit = specialKit(specials, slot);
    const egg = kit.ground.egg ?? kit.air?.egg;
    if (egg !== undefined) return egg;
  }
  return undefined;
}


function endHeroSpecial(f: Fighter, move: Readonly<AuthoredSpecial>): void {
  if ((move.helpless === true || (move.helplessOnMiss === true && !f.special.hit)) && !f.motion.grounded) {
    f.special.fall = true;
    f.jump.remaining = 0;
  }
  refreshAirOnExit(f);
  openParasol(f, move.parasol === true);
  f.special.action = SpecialAction.none;
  f.special.frame = 0;
  releaseCommandGrabLock(f, move);
}


function burstProjectiles(f: Fighter, from: Readonly<SpecialProjectile>, into: Readonly<SpecialProjectile>): void {
  const specials = f.tuning.specials;
  const kit = specials === undefined || f.special.action === SpecialAction.heroUltimate ? undefined : specialKit(specials, f.special.action - SpecialAction.heroNeutral);
  const ordinary = kit === undefined ? undefined : specialForm(kit, f.special.form, false, f.special.variant).burst;
  const upgraded = kit === undefined ? undefined : specialForm(kit, f.special.form, true, f.special.variant).burst;
  let index = -1;
  for (const before of f.projectiles) {
    index++;
    if (before.life <= 0 || before.kind !== ProjectileKind.hero
      || (before.spec !== from && before.spec !== ordinary?.from && before.spec !== upgraded?.from)) continue;
    const result = upgraded !== undefined && before.spec === upgraded.from ? upgraded.into : into;
    const projectile = mutableProjectile(f, index);
    projectile.spec = result;
    projectile.velocityX = 0.0;
    projectile.velocityZ = 0.0;
    projectile.life = result.life;
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

function endLiveCasts(f: Fighter, kit: Readonly<SpecialKit>): void {
  let index = -1;
  for (const projectile of f.projectiles) {
    index++;
    const spec = projectile.spec;
    if (projectile.life <= 0 || projectile.kind !== ProjectileKind.hero || spec === undefined) continue;
    if (castMakes(kit.ground, spec) || castMakes(kit.ground.ex, spec) || castMakes(kit.air, spec) || castMakes(kit.air?.ex, spec)) mutableProjectile(f, index).life = 0;
  }
}

function holdAim(f: Fighter, move: Readonly<AuthoredSpecial>, input: Readonly<Controls> | undefined, stage: number, matchFrame: number): boolean {
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

function steerShot(ball: Projectile, steer: Readonly<SpecialSteeredShot>, input: Readonly<Controls>, facing: number): void {
  const speed = squareRoot(f32(f32(ball.velocityX * ball.velocityX) + f32(ball.velocityZ * ball.velocityZ)));
  const stickX = input.diStickValid ? input.diStickX : input.direction;
  const stickZ = input.diStickValid ? input.diStickZ : input.verticalDirection;
  const stick = squareRoot(f32(f32(stickX * stickX) + f32(stickZ * stickZ)));
  if (speed <= 0.0 || stick <= 0.0) return;
  turnHeading(f32(ball.velocityX / speed), f32(ball.velocityZ / speed), f32(stickX / stick), f32(stickZ / stick), steer.turnCos, steer.turnSin, facing);
  ball.velocityX = f32(turned.x * speed);
  ball.velocityZ = f32(turned.z * speed);
  if (ball.velocityX !== 0.0) ball.direction = ball.velocityX < 0 ? -1 : 1;
}

function rootCaster(f: Fighter, steer: Readonly<SpecialSteeredShot>): void {
  const { motion } = f;
  motion.vx = 0.0;
  if (!motion.grounded) motion.vz = -steer.fallSpeed;
}

function holdSteeredShot(f: Fighter, move: Readonly<AuthoredSpecial>, input: Readonly<Controls> | undefined): boolean {
  const steer = move.steersShot;
  const shot = move.projectiles?.[0];
  if (steer === undefined || shot === undefined || f.special.frame !== steer.frame + 1) return false;
  let index = -1;
  for (const projectile of f.projectiles) {
    index++;
    if (projectile.life <= 0 || projectile.spec !== shot) continue;
    const ball = mutableProjectile(f, index);
    if (ball.life > steer.coast && (input?.specialPressed === true || input?.shieldPressed === true)) ball.life = steer.coast;
    else if (ball.life > steer.coast && input !== undefined) steerShot(ball, steer, input, f.facing);
    rootCaster(f, steer);
    f.special.frame = steer.frame;
    f.special.lockFrames++;
    f.attack.cooldown++;
    return true;
  }
  if (f.special.hit) f.special.frame = max(f.special.frame, move.endFrame - steer.hitRecovery);
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


function skipSpecialTo(f: Fighter, frame: number): void {
  const skipped = frame - f.special.frame;
  if (skipped <= 0) return;
  f.special.frame = frame;
  f.special.lockFrames = max(0, f.special.lockFrames - skipped);
  f.attack.cooldown = max(0, f.attack.cooldown - skipped);
}

function shortenOnPress(f: Fighter, window: Readonly<FrameWindow> | undefined, input: Readonly<Controls> | undefined): void {
  if (window !== undefined && input?.specialPressed === true && inWindow(window, f.special.frame)) skipSpecialTo(f, window.last + 1);
}


export function advanceHeroSpecial(f: Fighter, stage = 0, input?: Readonly<Controls>, world?: Roster, matchFrame = 0): void {
  const move = runningHeroSpecial(f);
  if (move === undefined) return;
  if (holdAim(f, move, input, stage, matchFrame) || holdCharge(f, move.charge)) return;
  if (holdSteeredShot(f, move, input)) return;
  advanceRefire(f, move.refire, input);
  shortenOnPress(f, move.shorten, input);
  if (throwFullDroppingCharge(f, move)) return;
  if (move.turnsAround === true) faceHeldStick(f, input);
  const frame = f.special.frame;
  if (move.cleanseFrame === frame) cleansePoisonAndSlow(f);
  if (move.rehits?.includes(frame) === true) for (let entry = 0; entry < PARTICIPANT_CAPACITY; entry++) f.special.hitTargets[entry] = undefined;
  if (move.buff?.frame === frame) applyItemBuffFor(f, move.buff.kind, move.buff.frames);
  if (frame === 1 && world !== undefined && f.special.seekTarget === 0 && seeks(move)) f.special.seekTarget = seekTargetSlot(world, f) + 1;
  if (move.beam !== undefined && world !== undefined) trackBeam(f, world, move.beam, frame);
  applyMotion(f, move, frame, input, world);
  stallAir(f, move, frame, input);
  for (const spec of move.projectiles ?? []) if (spec.spawnFrame === frame) spawnHeroProjectile(f, spec, f.attack.serial + 1, stage, matchFrame, world);
  if (move.placement !== undefined) placeObjects(f, move.placement, frame, stage, matchFrame);
  for (const summon of move.summons ?? []) placeObjects(f, summon, frame, stage, matchFrame);
  if (move.command?.frame === frame) orderCompanion(f, move.command.order, move.command.slot);
  if (move.burst?.frame === frame) burstProjectiles(f, move.burst.from, move.burst.into);
  if (move.ritual?.frame === frame) {
    f.status.armorFrames = 0;
    f.status.armorChills = false;
    gainUltimate(f, ultimatePercent(move.ritual.mana));
  }
  applyWindows(f, move, frame);
  if (frame >= heroSpecialEndFrame(f, move)) {
    if (move.recall === true) mutablePlacedObject(f).life = 0;
    endHeroSpecial(f, move);
  }
}


export function heroSpecialEndFrame(f: Readonly<Fighter>, move: Readonly<AuthoredSpecial>): number {
  const grab = move.commandGrab;
  return grab !== undefined && f.special.grabFrame > 0 ? f.special.grabFrame + grab.holdFrames + grab.recovery : move.endFrame;
}


function landFromSpecialFall(f: Fighter): void {
  const specials = f.tuning.specials;
  if (specials === undefined) return;
  for (let slot = SpecialSlot.neutral; slot <= SpecialSlot.down; slot++) {
    if ((f.special.airtimeUses & (1 << slot)) === 0) continue;
    const lag = specialForm(specialKit(specials, slot), SpecialForm.air, f.special.ex, f.special.variant).fallLandingLag;
    if (lag !== undefined) f.landing.lag = max(f.landing.lag, lag);
  }
}


export function carriesChargeAcrossLanding(f: Readonly<Fighter>): boolean {
  return runningHeroSpecial(f)?.carriesChargeOnLanding === true && f.special.form === SpecialForm.air;
}


export function landHeroSpecial(f: Fighter): boolean {
  const move = runningHeroSpecial(f);
  if (move === undefined) landFromSpecialFall(f);
  if (move?.landingLag === undefined) return false;
  const specials = f.tuning.specials;
  if (carriesChargeAcrossLanding(f) && specials !== undefined) {
    const ground = specialForm(specialKit(specials, f.special.action - SpecialAction.heroNeutral), SpecialForm.ground, f.special.ex, f.special.variant);
    f.special.form = SpecialForm.ground;
    f.special.duration = ground.endFrame;
    applyWindows(f, ground, f.special.frame);
    return true;
  }
  if (f.character === Character.cairne && f.special.action === SpecialAction.heroNeutral
    && f.special.form === SpecialForm.air && specials !== undefined
    && f.special.frame < (move.projectiles?.[0]?.spawnFrame ?? 0)) {
    const ground = specialForm(specials.neutral, SpecialForm.ground, f.special.ex, f.special.variant);
    f.special.form = SpecialForm.ground;
    f.special.duration = ground.endFrame;
    f.landing.lag = max(f.landing.lag, f.special.lockFrames);
    applyWindows(f, ground, f.special.frame);
    return true;
  }
  if (f.special.action === SpecialAction.heroDown && specials !== undefined
    && (f.special.form === SpecialForm.ground || f.special.form === SpecialForm.air)) {
    const ground = specialForm(specials.down, SpecialForm.ground, f.special.ex, f.special.variant);
    let firstEffect = move.endFrame;
    let groundFirstEffect = ground.endFrame;
    for (const form of [move, ground]) {
      let first = form.endFrame;
      for (const region of form.regions ?? []) first = min(first, region.firstFrame);
      for (const projectile of form.projectiles ?? []) first = min(first, projectile.spawnFrame);
      first = min(first, form.placement?.frame ?? first);
      first = min(first, form.command?.frame ?? first);
      first = min(first, form.guard?.first ?? first);
      first = min(first, form.commandGrab?.first ?? first);
      first = min(first, form.armor === undefined ? first : form.armor.first - 1);
      first = min(first, form.burst?.frame ?? first);
      first = min(first, form.buff?.frame ?? first);
      first = min(first, form.ritual?.frame ?? first);
      if (form === move) firstEffect = first;
      if (form === ground) groundFirstEffect = first;
    }
    if (f.special.frame < firstEffect) {
      f.special.form = SpecialForm.ground;
      if (f.special.frame >= groundFirstEffect) f.special.frame = 0;
      f.special.duration = ground.endFrame;
      f.special.lockFrames = max(0, ground.endFrame - f.special.frame);
      f.attack.cooldown = f.special.lockFrames;
      applyWindows(f, ground, f.special.frame);
      return true;
    }
  }
  refreshAirOnExit(f);
  f.special.action = SpecialAction.none;
  f.special.frame = 0;
  f.special.lockFrames = 0;
  f.attack.cooldown = 0;
  f.landing.lag = max(f.landing.lag, move.landingLag);
  return true;
}


const strike = emptyCapsule();

export function agesWithMove(owner: Readonly<Fighter>, projectile: Readonly<Projectile>): boolean {
  const spec = projectile.spec;
  if (owner.launch.hitlag <= 0 || owner.special.action !== SpecialAction.heroUltimate || spec === undefined || !neverStrikes(spec)) return false;
  return runningHeroSpecial(owner)?.projectiles?.includes(spec) === true;
}

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



export function advanceHeroStatus(f: Fighter): void {
  if (f.status.armorFrames > 0) f.status.armorFrames--;
  if (f.status.divineFrames > 0) f.status.divineFrames--;
  advanceHeroConditions(f);
}


export function specialCooldownReady(f: Readonly<Fighter>, action: number): boolean {
  return (f.special.cooldowns[action] ?? 0) <= 0;
}





export function stopHeroMotionAtBodies(world: Roster, slot: number): void {
  const f = fighterAt(world, slot);
  const move = runningHeroSpecial(f);
  if (move?.motion === undefined) return;
  const frame = f.special.frame;
  for (const segment of move.motion) {
    if ((segment.stopsAtBody !== true && segment.stopsAtShield !== true) || frame < segment.first || frame > segment.last) continue;
    const forward = f32(f.motion.vx * f.facing);
    if (forward <= 0.0) return;
    f.motion.vx = f32(f.facing * travelBeforeBodies(world, slot, forward, segment.stopsAtBody === true));
    return;
  }
}









function settleOnFloorBelow(f: Fighter, stage: number, matchFrame: number): void {
  const { motion } = f;
  const floor = motion.grounded ? undefined : floorSurfaceBelow(stage, matchFrame, motion.x, motion.z);
  if (floor === undefined) return;
  motion.grounded = true;
  motion.surface = floor;
  motion.z = surfaceZAt(stage, floor, matchFrame, motion.x);
  motion.vz = 0.0;
  motion.fastFalling = false;
  setWorldMotionValue(motion.meleeZ, motion.z);
  clearMotionValue(motion.meleeVelocityZ);
}

function moveToRelocation(world: Roster, f: Fighter, segment: Readonly<SpecialMotion>): boolean {
  if (segment.relocateProjectile !== undefined) {
    const anchor = projectileAnchor(f, segment.relocateProjectile);
    if (anchor === undefined) return false;
    f.motion.x = anchor.x;
    f.motion.z = anchor.z;
  } else {
    if (f.placed.life <= 0) return false;
    const placed = mutablePlacedObject(f);
    f.motion.x = placed.x;
    f.motion.z = placed.z;
    f.facing = placed.direction;
    placed.life = 0;
  }
  return true;
}

const BEHIND_TARGET = 60.0;

function stepBehind(f: Fighter, target: Readonly<Fighter>): void {
  const back = target.facing < 0 ? 1 : -1;
  f.motion.x = f32(target.motion.x + f32(back * BEHIND_TARGET));
  f.motion.z = target.motion.z;
  f.facing = -back;
}

function standBesideTarget(f: Fighter, target: Readonly<Fighter>): void {
  const { motion } = f;
  motion.vx = 0.0;
  motion.vz = 0.0;
  motion.fastFalling = false;
  motion.grounded = target.motion.grounded;
  motion.surface = target.motion.surface;
  setWorldMotionValue(motion.meleeZ, motion.z);
  clearMotionValue(motion.meleeVelocityZ);
}

export function lockedTarget(world: Roster, f: Readonly<Fighter>, range: number): Fighter | undefined {
  const slot = f.special.seekTarget - 1;
  if (slot < 0 || !isActive(world, slot)) return undefined;
  const target = fighterAt(world, slot);
  if (target.status.out || Math.abs(f32(target.motion.x - f.motion.x)) > range || Math.abs(f32(target.motion.z - f.motion.z)) > range) return undefined;
  return target;
}

export function relocateHeroSpecial(world: Roster, slot: number, stage: number, matchFrame: number): void {
  const f = fighterAt(world, slot);
  const move = runningHeroSpecial(f);
  if (move?.motion === undefined) return;
  for (const segment of move.motion) {
    if ((segment.relocate === undefined && segment.relocateProjectile === undefined) || f.special.frame !== segment.first) continue;
    if (segment.relocate === Relocation.floorBelow) {
      settleOnFloorBelow(f, stage, matchFrame);
      return;
    }
    if (segment.relocate === Relocation.behindLocked) {
      const target = lockedTarget(world, f, segment.relocateReach ?? 0.0);
      if (target === undefined) return;
      stepBehind(f, target);
      standBesideTarget(f, target);
      return;
    }
    if (!moveToRelocation(world, f, segment)) return;
    f.motion.vx = 0.0;
    f.motion.vz = 0.0;
    f.motion.grounded = false;
    f.motion.surface = undefined;
    return;
  }
}

/** Starts the running move's contact follow-up once it has struck; call before the frame advances. */
export function followUpOnContact(f: Fighter): void {
  const { special } = f;
  if (!special.hit || special.form >= FOLLOW_UP_FORM) return;
  const followUps = runningHeroSpecial(f)?.followUps ?? [];
  for (let index = 0; index < followUps.length; index++) {
    const followUp = at(followUps, index);
    if (followUp.input !== FollowUpInput.contact || !inWindow(followUp.window, special.frame + 1)) continue;
    special.form += FOLLOW_UP_FORM * (index + 1);
    enterFollowUp(f, followUp.special);
    return;
  }
}

function followUpPressed(f: Readonly<Fighter>, followUp: Readonly<SpecialFollowUp>, input: Readonly<Controls>): boolean {
  const kind = followUp.input ?? FollowUpInput.special;
  const x = chargedAimX(input);
  const z = chargedAimZ(input);
  const pressed = kind === FollowUpInput.attack ? input.attackPressed : kind === FollowUpInput.shield ? input.shieldPressed : kind === FollowUpInput.special ? input.specialPressed : kind === FollowUpInput.release ? !input.specialHeld : kind === FollowUpInput.auto && changesAimZone(f, x, z);
  const stick = followUp.stick;
  return pressed && (stick === undefined || (Math.abs(x) === stick.x && z === stick.z));
}






export function followUpHeroSpecial(f: Fighter, input: Readonly<Controls>): boolean {
  const { special } = f;
  const move = runningHeroSpecial(f);
  const followUps = move?.followUps;
  if (followUps === undefined || special.form >= FOLLOW_UP_FORM || f.launch.hitlag > 0 || f.launch.hitstun > 0) return false;
  let index = 0;
  while (index < followUps.length && !(inWindow(at(followUps, index).window, special.frame + 1) && chargeStageOpen(f, move?.charge, at(followUps, index)) && followUpPressed(f, at(followUps, index), input))) index++;
  if (index >= followUps.length) return false;
  const followUp = at(followUps, index);
  const next = followUp.special;
  if (followUp.facesStick === true && input.direction !== 0) f.facing = input.direction < 0 ? -1 : 1;
  if (followUp.stick !== undefined && followUp.stick.x !== 0) f.facing = chargedAimX(input) < 0 ? -1 : 1;
  special.form += FOLLOW_UP_FORM * (index + 1);
  enterFollowUp(f, next);
  return true;
}


export function enterFollowUp(f: Fighter, next: Readonly<AuthoredSpecial>): void {
  const { special } = f;
  special.frame = 0;
  special.duration = next.endFrame;
  special.lockFrames = next.endFrame;
  if (next.spendsCharge === true) special.charge = 0;

  f.attack.cooldown = next.endFrame;
  for (let entry = 0; entry < PARTICIPANT_CAPACITY; entry++) special.hitTargets[entry] = undefined;
  special.hit = false;
  applyWindows(f, next, 0);
}


/** Starts the fighter's ultimate after the special action began (docs/design/ultimates.md). */
export function enterUltimate(f: Fighter, input: Readonly<Controls>): AuthoredSpecial | undefined {
  const move = f.tuning.ultimate;
  if (move === undefined) return undefined;
  const { special } = f;
  endDivineShield(f);
  special.form = 0;
  special.variant = airCastVariant(f, move);
  special.grabFrame = 0;
  const aimX = input.specialX !== 0 ? input.specialX : input.direction;
  const aimZ = input.specialZ !== 0 ? input.specialZ : input.verticalDirection;
  special.aimX = aimX < 0 ? -1 : aimX > 0 ? 1 : 0;
  special.aimZ = aimZ < 0 ? -1 : aimZ > 0 ? 1 : 0;
  for (let entry = 0; entry < PARTICIPANT_CAPACITY; entry++) special.hitTargets[entry] = undefined;
  special.hit = false;
  special.guarded = false;
  special.seekTarget = 0;
  applyWindows(f, move, 0);
  return move;
}


export function faceHeldStick(f: Fighter, input: Readonly<Controls> | undefined): void {
  if (input !== undefined && input.direction !== 0) f.facing = input.direction < 0 ? -1 : 1;
}


export function heroSpecialCancelOpen(f: Readonly<Fighter>): boolean {
  const move = runningHeroSpecial(f);
  return move?.jumpCancelFrame !== undefined && f.launch.hitlag <= 0 && f.special.frame >= move.jumpCancelFrame;
}


export function endCancelledSpecial(f: Fighter): void {
  f.special.action = SpecialAction.none;
  f.special.frame = 0;
  f.special.lockFrames = 0;
  f.attack.cooldown = 0;
}


export function jumpCancelHeroSpecial(f: Fighter, input: Readonly<Controls>): void {
  if (input.jumpPressed && heroSpecialCancelOpen(f)) endCancelledSpecial(f);
}
