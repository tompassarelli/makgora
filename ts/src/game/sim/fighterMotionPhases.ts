import { max, min } from "../core/numbers";
import { f32 } from "wisp/src/sim/f32";
import { Character, LedgeState, ShieldBreak, SurfaceContact } from "./codes";
import { SPOT_DODGE_FRAMES, GROUND_ROLL_FRAMES, WALL_TECH_STARTUP_FRAMES, inGrabContext, isForwardGroundRoll } from "./conditions";
import { type Fighter } from "./fighter";
import { heroMotionHolds } from "./specials/heroMotion";
import { carryHeroStatus, pullHeroStatus } from "./heroStatus";
import { demonHunterAuthoredMotion } from "./specials";
import { beginAirDodge } from "./jumpsAndDodges";
import { advanceLedge } from "./ledge";
import { EARLY_ASCENT_GRAB_FRAMES, attackFall } from "./moves";
import { type Controls, type Roster } from "./roster";
import { carryThrowRequested, lowerCarryJump } from "./cargoCarry";
import { type AuthoredFall } from "./heroMoves";
import { advanceShieldInputClocks } from "./shield";
import { advanceShieldBreak } from "./shieldBreak";

import { checkBlastZone } from "./stocks";
import { forwardRollTurnFrame } from "./geometry/rollTravel";
import { jumpBuffed } from "./itemBuffs";
import { advanceDownMotion, cancelJumpStates, drainShieldEnergy } from "./motionSteps";

function advanceJumpSquat(f: Fighter, input: Readonly<Controls>, squatBeforeInput: number): boolean {
  const { jump, motion } = f;
  const physics = f.tuning.physics;

  const illidan = f.character === Character.demonHunter;
  if (jump.ascent > 0) jump.ascent = motion.grounded || jump.ascent >= EARLY_ASCENT_GRAB_FRAMES ? 0 : jump.ascent + 1;
  if (!(jump.squat > 0 && f.launch.hitlag === 0 && (illidan || squatBeforeInput > 0))) return false;
  jump.squat--;
  if (jump.squat !== 0) return false;
  motion.grounded = false;
  const jumpX = f32(f32(motion.vx * physics.jumpMomentum) + f32(input.direction * physics.jumpHorizontalSpeed));
  motion.vx = max(-physics.jumpHorizontalCap, min(physics.jumpHorizontalCap, jumpX));
  motion.vz = jumpBuffed(f, jump.held ? physics.fullJumpSpeed : physics.shortJumpSpeed);
  jump.ascent = 1;
  jump.serial++;
  jump.isDouble = false;
  if (jump.dodgeQueued) {
    jump.dodgeQueued = false;
    beginAirDodge(f, jump.dodgeX, jump.dodgeZ, true);
    jump.dodgeX = 0;
    jump.dodgeZ = 0;
  }
  return !illidan;
}

function advanceGroundDodge(f: Fighter, groundDodgeStarted: boolean): void {
  const { dodge } = f;
  if (dodge.groundFrame <= 0 || groundDodgeStarted) return;
  dodge.groundFrame++;
  const dodgeFrames = dodge.groundDirection === 0 ? SPOT_DODGE_FRAMES : GROUND_ROLL_FRAMES;
  const turnFrame = forwardRollTurnFrame(f.character);
  if (isForwardGroundRoll(f) && dodge.groundFrame === turnFrame) f.facing = -dodge.groundEntryFacing;
  if (dodge.groundFrame > dodgeFrames) {
    if (isForwardGroundRoll(f) && turnFrame === undefined) f.facing = -dodge.groundEntryFacing;
    dodge.groundFrame = 0;
    dodge.groundDirection = 0;
    dodge.groundEntryFacing = 0;
    f.motion.vx = 0.0;
  }
}

export function advanceLedgeOrShieldStops(f: Fighter, world: Roster, slot: number, stage: number, matchFrame: number, input: Readonly<Controls>): boolean {
  if (f.ledge.state !== LedgeState.none) {
    advanceLedge(world, slot, stage, input);
    return true;
  }
  if (f.shield.breakState !== ShieldBreak.none && advanceShieldBreak(world, slot, stage, matchFrame, input)) return true;
  return drainShieldEnergy(f, world, slot, stage, input);
}

export function isWallTechStartup(f: Fighter): boolean {
  return f.surfaceRecovery.state === SurfaceContact.techWall && f.surfaceRecovery.frame < WALL_TECH_STARTUP_FRAMES;
}

export function advanceStartupStops(f: Fighter, world: Roster, slot: number, stage: number, wallTechStartup: boolean, carrying: boolean): boolean {
  if (!wallTechStartup && !(inGrabContext(f) && !carrying)) return false;
  if (f.launch.hitlag <= 0) f.status.invincible = max(0, f.status.invincible - 1);
  checkBlastZone(world, slot, stage);
  return true;
}

export function advanceGrabStops(f: Fighter, world: Roster, slot: number, stage: number, carrying: boolean): boolean {
  if (f.grab.target === undefined || carrying) return false;
  checkBlastZone(world, slot, stage);
  return true;
}

export function advanceHitstunAndJumpCancel(f: Fighter, input: Readonly<Controls>): number {
  const { launch, jump } = f;
  if (launch.hitlag <= 0) launch.hitstun = max(0, launch.hitstun - 1);
  if (launch.hitstun === 0) launch.throwHitstun = false;
  const squatBeforeInput = jump.squat;
  if (input.jumpPressed) cancelJumpStates(f, input);
  return squatBeforeInput;
}

export function advanceGroundTakeoff(f: Fighter, input: Readonly<Controls>, carrying: boolean, squatBeforeInput: number): boolean {
  const groundTakeoff = advanceJumpSquat(f, input, squatBeforeInput);
  if (carrying && groundTakeoff) lowerCarryJump(f);
  return groundTakeoff;
}

export function advanceFrameTimersAndDown(f: Fighter, world: Roster, slot: number, stage: number, matchFrame: number, input: Readonly<Controls>, groundDodgeStarted: boolean): boolean {
  if (f.launch.hitlag > 0) return true;
  advanceShieldInputClocks(f, input);
  advanceGroundDodge(f, groundDodgeStarted);
  checkBlastZone(world, slot, stage);
  if (f.status.out) return true;
  return advanceDownMotion(f, world, slot, stage, matchFrame, input);
}

export function movementDirection(f: Fighter, input: Readonly<Controls>, carrying: boolean): number {
  return carrying && carryThrowRequested(f, input) ? 0 : input.direction;
}

export function authoredMotionHeld(f: Fighter, world: Roster): boolean {
  return pullHeroStatus(world, f) || carryHeroStatus(f) || heroMotionHolds(f) || demonHunterAuthoredMotion(f);
}

export function airborneDrill(f: Fighter): AuthoredFall | undefined {
  return f.motion.grounded ? undefined : attackFall(f.attack.style, f.attack.frame, f.tuning.moves);
}
