



import { f32 } from "wisp/src/sim/f32";
import { max, min } from "../core/numbers";
import { PARTICIPANT_SLOTS } from "../input/participants";
import type { Fighter } from "./fighter";
import { type Roster, fighterAt, isActive } from "./roster";
import { SEA_SURFACE_Z, TIDE_SPEED, hasTide, inSea, tideDirection, tidePush } from "./stageHazards";
import { moveMeleeX, setWorldMotionValue } from "./motion";
import { melee } from "./tuning";
import { SurfaceContact } from "./codes";
import { aerialJumps, jumpBuffed } from "./itemBuffs";
import { JUMP_BIT, lockedOut } from "./jumpsAndDodges";
import { observeActionDecision, observeActionStart } from "./observations";
import { clearDownState } from "./transitions";
import { stageBounds } from "./stageBounds";
import { checkBlastZone } from "./stocks";


export const HYDRA_TRIGGER_FRAMES = 150;

export const HYDRA_TELL_FRAMES = 45;
export const HYDRA_STRIKE_FRAME = HYDRA_TELL_FRAMES + 1;

export const HYDRA_REACH = 150.0;

export const HYDRA_CATCH_DAMAGE = 15.0;


const WATER_BUOYANCY = melee(0.10000000149011612);
const WATER_RISE_CAP = melee(3.0);

export const SWIM_SPEED = melee(0.6000000238418579);
export const SWIM_ACCELERATION = melee(0.05000000074505806);

export const WATER_JUMP_FACTOR = 0.9100000262260437;
export const WATER_JUMP_REENTRIES = 4;


function waterJumpScale(entries: number): number {
  let scale = 1.0;
  for (let reentry = 1; reentry < min(entries, WATER_JUMP_REENTRIES + 1); reentry++) scale = f32(scale * WATER_JUMP_FACTOR);
  return scale;
}


export function applyBuoyancy(f: Fighter): void {
  f.motion.vz = min(WATER_RISE_CAP, f32(f.motion.vz + WATER_BUOYANCY));
  f.motion.fastFalling = false;
  f.special.fall = false;
}


export function floatAtSurface(f: Fighter): void {
  const { motion } = f;
  if (motion.z <= SEA_SURFACE_Z) return;
  motion.z = SEA_SURFACE_Z;
  motion.vz = 0.0;
  setWorldMotionValue(motion.meleeZ, motion.z);
  setWorldMotionValue(motion.meleeVelocityZ, 0.0);
}






export function beginWaterJump(f: Fighter, horizontal: number): boolean {
  const { motion, jump } = f;
  if (lockedOut(f) || f.dodge.airDodging || jump.squat > 0) return false;
  observeActionDecision(JUMP_BIT);
  const physics = f.tuning.physics;
  f.surfaceRecovery.state = SurfaceContact.none;
  f.surfaceRecovery.frame = 0;
  motion.fastFalling = false;
  const jumpX = f32(f32(motion.vx * physics.jumpMomentum) + f32(horizontal * physics.jumpHorizontalSpeed));
  motion.vx = max(-physics.jumpHorizontalCap, min(physics.jumpHorizontalCap, jumpX));
  motion.vz = f32(jumpBuffed(f, physics.fullJumpSpeed) * waterJumpScale(f.water.entries));
  jump.serial++;
  jump.isDouble = false;
  jump.remaining = max(jump.remaining, aerialJumps(f));
  f.dodge.airUsed = false;
  clearDownState(f);
  observeActionStart(JUMP_BIT);
  return true;
}


export const wet = (f: Readonly<Fighter>, stage: number): boolean => !f.motion.grounded && inSea(stage, f.motion.x, f.motion.z);


export function swimVelocity(vx: number, direction: number): number {
  const target = direction > 0 ? SWIM_SPEED : -SWIM_SPEED;
  return direction > 0 ? min(target, max(vx, f32(vx + SWIM_ACCELERATION))) : max(target, min(vx, f32(vx - SWIM_ACCELERATION)));
}








export function advanceWater(world: Roster, stage: number, matchFrame: number, hazards: boolean): void {
  if (!hasTide(stage)) return;
  for (const slot of PARTICIPANT_SLOTS) {
    if (!isActive(world, slot)) continue;
    const f = fighterAt(world, slot);
    if (f.status.out) continue;
    const { motion, water } = f;
    moveMeleeX(f, tidePush(stage, matchFrame, motion.x, motion.z));
    const now = inSea(stage, motion.x, motion.z);
    if (motion.grounded) {
      water.frames = 0;
      water.entries = 0;
    }
    if (now && !water.inWater) {
      water.entries++;
      f.special.airtimeUses = 0;
    }
    if (now) water.frames++;
    water.inWater = now;

    if (water.hydraFrame > 0) {
      water.hydraFrame++;
      water.hydraX = f32(water.hydraX + f32(tideDirection(matchFrame) * TIDE_SPEED));
    } else if (hazards && now && water.frames >= HYDRA_TRIGGER_FRAMES) {
      water.hydraFrame = 1;
      water.hydraX = motion.x;
    }
  }
}


function hydraCatch(world: Roster, slot: number, stage: number): void {
  const f = fighterAt(world, slot);
  f.status.damage = f32(f.status.damage + HYDRA_CATCH_DAMAGE);
  f.motion.z = f32(stageBounds(stage).blast.bottom - 1.0);
  setWorldMotionValue(f.motion.meleeZ, f.motion.z);
  checkBlastZone(world, slot, stage);
}


export function collectHydraContacts(world: Roster, stage: number, matchFrame: number): void {
  if (!hasTide(stage)) return;
  for (const slot of PARTICIPANT_SLOTS) {
    if (!isActive(world, slot)) continue;
    const f = fighterAt(world, slot);
    const { water } = f;
    if (water.hydraFrame < HYDRA_STRIKE_FRAME) continue;
    if (!f.status.out && inSea(stage, f.motion.x, f.motion.z)) hydraCatch(world, slot, stage);
    water.hydraStrikeFrame = matchFrame;
    water.hydraFrame = 0;
    water.frames = 0;
  }
}
