import { sameTeam } from "../teams";
import { max, min } from "../../core/numbers";
import { f32 } from "wisp/src/sim/f32";
import { DuoRole, SpecialAction, SpecialCarry } from "../codes";
import { mutableProjectile } from "../fighterProjectiles";
import { type Fighter, type Projectile, duoRole, mutablePlacedObject } from "../fighter";
import { type AuthoredSpecial, type SpecialMotion, type SpecialSteer, type SpecialSteeredShot, FOLLOW_UP_FORM, Relocation } from "./schema";
import { castFloating, floatsNow } from "./airFloat";
import { type Controls, type Roster, fighterAt, isActive } from "../roster";
import { travelBeforeBodies } from "../travelStop";
import { PARTICIPANT_CAPACITY } from "../../input/participants";
import { specialPlacements } from "./placements";
import { clearMotionValue, setWorldMotionValue } from "../motion";
import { squareRoot } from "../warcraftMath";
import { isHeroSpecialAction, runningHeroSpecial, inWindow, projectileAnchor } from "./runningMove";
import { strike } from "./heroContact";
import { resurfaceHeroSpecial } from "./resurface";
import { enterFollowUp } from "./heroForms";
import { skipSpecialTo } from "./refire";

type SpecialBoard = NonNullable<SpecialMotion["board"]>;
type SpecialLink = NonNullable<AuthoredSpecial["link"]>;
const DIAGONAL = 0.7071067690849304;

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

export function seeks(move: Readonly<AuthoredSpecial>): boolean {
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

const flight = { x: 0.0, z: 0.0 };

function scriptedVelocity(f: Fighter, segment: Readonly<SpecialMotion>): void {
  const { special } = f;
  flight.x = f32(f.facing * segment.velocityX);
  flight.z = segment.velocityZ;
  if (segment.freeAim === true && segment.aimedSpeed !== undefined && (special.aimX !== 0 || special.aimZ !== 0)) {
    const length = squareRoot(f32(f32(special.aimX * special.aimX) + f32(special.aimZ * special.aimZ)));
    flight.x = f32(f32(special.aimX / length) * segment.aimedSpeed);
    flight.z = f32(f32(special.aimZ / length) * segment.aimedSpeed);
    if (flight.x !== 0.0 && (special.aimX < 0) !== (f.facing < 0)) f.facing = special.aimX < 0 ? -1 : 1;
    return;
  }
  if (segment.aimedSpeed !== undefined && (special.aimX !== 0 || special.aimZ !== 0)) {
    const scale = special.aimX !== 0 && special.aimZ !== 0 ? f32(segment.aimedSpeed * DIAGONAL) : segment.aimedSpeed;
    flight.x = f32(special.aimX * scale);
    flight.z = f32(special.aimZ * scale);
  } else if (segment.aimedTilt !== undefined && special.aimZ !== 0) {
    flight.x = f32(flight.x * segment.aimedTilt.x);
    flight.z = f32(f32(special.aimZ * Math.abs(segment.velocityX)) * segment.aimedTilt.z);
  }
}

function stickVelocity(segment: Readonly<SpecialMotion>, input: Readonly<Controls> | undefined): void {
  if (segment.driftSpeed !== undefined && input !== undefined) {
    const stick = input.diStickValid ? input.diStickX : input.direction;
    flight.x = f32(flight.x + f32(min(1.0, max(-1.0, stick)) * segment.driftSpeed));
  }
  if (segment.liftSpeed !== undefined && input !== undefined) {
    const stick = input.diStickValid ? input.diStickZ : input.verticalDirection;
    flight.z = f32(flight.z + f32(min(1.0, max(-1.0, stick)) * segment.liftSpeed));
  }
}

function linkedSlot(f: Readonly<Fighter>): number {
  return f.duo?.link ?? -1;
}

function riderOf(world: Roster, f: Readonly<Fighter>): Fighter | undefined {
  if (duoRole(f) !== DuoRole.leader || !isActive(world, linkedSlot(f))) return undefined;
  const rider = fighterAt(world, linkedSlot(f));
  return rider.status.out ? undefined : rider;
}

function boardsRider(f: Readonly<Fighter>, rider: Readonly<Fighter>, reach: number): boolean {
  const dx = f32(rider.motion.x - f.motion.x);
  const dz = f32(rider.motion.z - f.motion.z);
  return rider.special.action === f.special.action && rider.special.form === f.special.form && rider.special.variant === f.special.variant
    && rider.launch.hitlag <= 0 && f32(f32(dx * dx) + f32(dz * dz)) <= f32(reach * reach);
}

function decideLink(f: Fighter, world: Roster, link: Readonly<SpecialLink>): void {
  const rider = riderOf(world, f);
  if (rider === undefined || !boardsRider(f, rider, link.reach)) return;
  f.special.carry = SpecialCarry.carrier;
  f.special.variant = link.variant;
  rider.special.carry = SpecialCarry.rider;
  rider.special.variant = link.variant;
  rider.special.frame = linkedSlot(f) > world.fighters.indexOf(f) ? f32(f.special.frame - 1) : f.special.frame;
}

function ridingPartner(f: Readonly<Fighter>, world: Roster): Fighter | undefined {
  const rider = riderOf(world, f);
  return rider !== undefined && rider.special.carry === SpecialCarry.rider ? rider : undefined;
}

function endRide(f: Fighter): void {
  f.special.carry = SpecialCarry.none;
  const move = runningHeroSpecial(f);
  if (move !== undefined) skipSpecialTo(f, move.endFrame - 1);
}

function dropRide(f: Fighter): void {
  endRide(f);
  f.motion.vx = 0.0;
  f.motion.vz = 0.0;
}

function carryRider(f: Fighter, world: Roster, board: Readonly<SpecialBoard>): void {
  if (f.special.carry !== SpecialCarry.carrier) return;
  const rider = ridingPartner(f, world);
  if (rider === undefined) {
    dropRide(f);
    return;
  }
  const { motion } = rider;
  const wantX = f32(f.motion.x + f.motion.vx);
  const wantZ = f32(f32(f.motion.z + f.motion.vz) - board.drop);
  motion.vx = f32(f.motion.vx + min(board.catchUp, max(-board.catchUp, f32(f32(wantX - motion.x) - f.motion.vx))));
  motion.vz = f32(f.motion.vz + min(board.catchUp, max(-board.catchUp, f32(f32(wantZ - motion.z) - f.motion.vz))));
  rider.facing = f.facing;
  motion.grounded = false;
  motion.surface = undefined;
}

function dismountRider(f: Fighter, world: Roster, push: number): void {
  if (f.special.carry !== SpecialCarry.carrier) return;
  f.special.carry = SpecialCarry.none;
  const rider = ridingPartner(f, world);
  if (rider === undefined) return;
  endRide(rider);
  const { vx, vz } = f.motion;
  const speed = squareRoot(f32(f32(vx * vx) + f32(vz * vz)));
  rider.motion.vx = speed > 0.0 ? f32(f32(vx / speed) * push) : 0.0;
  rider.motion.vz = speed > 0.0 ? f32(f32(vz / speed) * push) : push;
}

export function riderPaused(world: Roster, f: Fighter): boolean {
  if (f.special.carry !== SpecialCarry.rider) return false;
  const carrier = isActive(world, linkedSlot(f)) ? fighterAt(world, linkedSlot(f)) : undefined;
  if (carrier === undefined || carrier.special.carry !== SpecialCarry.carrier || carrier.special.action !== f.special.action) {
    dropRide(f);
    return false;
  }
  if (carrier.launch.hitlag <= 0) return false;
  f.motion.vx = 0.0;
  f.motion.vz = 0.0;
  return true;
}

function segmentFlight(f: Fighter, segment: Readonly<SpecialMotion>, frame: number, input: Readonly<Controls> | undefined, world: Roster | undefined): void {
  const { motion } = f;
  scriptedVelocity(f, segment);
  if (segment.dismount !== undefined && world !== undefined && frame === segment.first) dismountRider(f, world, segment.dismount.push);
  stickVelocity(segment, input);
  if (segment.steer !== undefined) {
    steerFlight(f, segment.steer, frame === segment.first, input);
    flight.x = motion.vx;
    flight.z = motion.vz;
  }
  if (segment.seek !== undefined && world !== undefined) {
    seekFoe(f, world, segment.seek.speed, segment.seek.turnCos, segment.seek.turnSin);
    flight.x = motion.vx;
    flight.z = motion.vz;
  }
  motion.vx = flight.x;
  motion.vz = flight.z;
  if (segment.board !== undefined && world !== undefined) carryRider(f, world, segment.board);
}

export function applyMotion(f: Fighter, cast: Readonly<AuthoredSpecial>, frame: number, input: Readonly<Controls> | undefined, world: Roster | undefined): void {
  holdHoveringUltimate(f);
  if (f.special.grabFrame > 0 && cast.commandGrab !== undefined) return;
  if (cast.link !== undefined && world !== undefined && frame === cast.link.frame) decideLink(f, world, cast.link);
  const move = cast.link !== undefined ? runningHeroSpecial(f) ?? cast : cast;
  if (f.special.carry === SpecialCarry.rider) return;
  if (!ultimateHovers(f) && fallsFreely(f, move, frame)) return;
  for (const segment of move.motion ?? []) {
    if (frame < segment.first || frame > segment.last) continue;
    segmentFlight(f, segment, frame, input, world);
    if (segment.facesStruck === true && frame === segment.first && world !== undefined) faceStruck(f, world);
    if (flight.z > 0 && f.motion.grounded) {
      f.motion.grounded = false;
      f.motion.surface = undefined;
    }
  }
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

function shotStrikesCaster(f: Readonly<Fighter>, ball: Readonly<Projectile>, steer: Readonly<SpecialSteeredShot>): boolean {
  const self = steer.selfHit;
  const spec = ball.spec;
  if (self === undefined || spec === undefined || f32(spec.life - ball.life) < self.armedAfter) return false;
  const dx = f32(ball.x - f.motion.x);
  const dz = f32(ball.z - f32(f.motion.z + self.bodyZ));
  return f32(f32(dx * dx) + f32(dz * dz)) <= f32(self.radius * self.radius);
}

function launchCaster(f: Fighter, ball: Projectile, launch: Readonly<AuthoredSpecial>): void {
  const { special } = f;
  special.aimX = ball.velocityX;
  special.aimZ = ball.velocityZ;
  ball.life = 0;
  special.form += FOLLOW_UP_FORM;
  enterFollowUp(f, launch);
}

export function holdSteeredShot(f: Fighter, move: Readonly<AuthoredSpecial>, input: Readonly<Controls> | undefined): boolean {
  const steer = move.steersShot;
  const shot = move.projectiles?.[0];
  if (steer === undefined || shot === undefined || f.special.frame !== steer.frame + 1) return false;
  let index = -1;
  for (const projectile of f.projectiles) {
    index++;
    if (projectile.life <= 0 || projectile.spec !== shot) continue;
    const ball = mutableProjectile(f, index);
    const launch = move.followUps?.[0]?.special;
    if (launch !== undefined && shotStrikesCaster(f, ball, steer)) {
      launchCaster(f, ball, launch);
      return true;
    }
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
    if (segment.resurface !== undefined && f.special.frame === segment.first) {
      resurfaceHeroSpecial(f, segment.resurface, stage, matchFrame);
      return;
    }
    if ((segment.relocate === undefined && segment.relocateProjectile === undefined) || f.special.frame !== segment.first) continue;
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

export function faceHeldStick(f: Fighter, input: Readonly<Controls> | undefined): void {
  if (input !== undefined && input.direction !== 0) f.facing = input.direction < 0 ? -1 : 1;
}
