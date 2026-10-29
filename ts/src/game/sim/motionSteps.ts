import { max, min } from "../core/numbers";
import { divideFloat32, subtractFloat32 } from "wisp/src/sim/binary32";
import { f32 } from "wisp/src/sim/f32";
import { Character, DownState, GroundAction, ParryBuffer, SpecialAction, SurfaceContact } from "./codes";
import { GROUND_ROLL_FRAMES, SPOT_DODGE_FRAMES, inGrabContext, isFloorTeching, isForwardGroundRoll, isGroundDodging, isTumbling } from "./conditions";
import {
  DOWN_ROLL_FRAMES,
  DOWN_STAND_FRAMES,
  GROUND_ROLL_MOVE_END,
  GROUND_ROLL_MOVE_START,
  GROUND_ROLL_SPEED,
  TECH_IN_PLACE_FRAMES,
  TECH_ROLL_FRAMES,
  advanceDownState,
  finishLanding,
  resolveDownGroundContact,
} from "./down";
import {
  FAST_FALL_INPUT_WINDOW,
  type Fighter,
  PLATFORM_DROP_INPUT_WINDOW,
  SHIELD_POWERSHIELD_INPUT_WINDOW_FRAMES,
  TURNAROUND_SPECIAL_WINDOW_FRAMES,
  WALL_JUMP_FLICK_FRAMES,
} from "./fighter";
import { DASH_GUARD_EARLY_FRAMES, advanceGroundMovement, clearDash, groundOptionOpen, readWavedashExit, restingTraction, wantsCrouch } from "./groundMovement";
import { GroundOption } from "./stickZones";
import { heroEgg, heroMotionPassesPlatforms, heroSpecialJumps, jumpCancelHeroSpecial } from "./specials/engine";
import { demonHunterJumpCancel } from "./specials";
import { tickEmpowered } from "./specials/empowered";
import { heroStatusFall } from "./heroStatus";
import { closeParasol, endParasolAerial, parasolFall, reopenParasol } from "./parasol";
import { AIR_DODGE_DECAY, AIR_DODGE_DECAY_FRAMES, beginAirDodge, beginGroundDodge, beginJump, canBeginGroundDodge, endFinishedAirDodge } from "./jumpsAndDodges";
import { ageKnockback, applyDirectionalInfluence, decayKnockback } from "./knockback";
import { EdgePass, passThroughEdge, rideWall, teleportsThisFrame } from "./edgeRecovery";
import { DOWN_ATTACK_FRAMES, EARLY_ASCENT_GRAB_FRAMES, SMASH_MAX_HOLD_FRAMES, attackFall, isSmashAttack, smashChargeFrame } from "./moves";
import {
  addMeleeWorldValues,
  airDriftVelocity,
  applyMeleeGravity,
  moveMeleeVerticalVelocity,
  moveMeleeX,
  moveMeleeZ,
  slopedLandingZ,
  totalVelocityX,
  totalVelocityZ,
} from "./motion";
import { observeActionDecision, observeActionStart } from "./observations";
import * as platforms from "./platformMoves";
import { type Controls, type Roster } from "./roster";
import { canTeeter, grabHoldsEdge, shieldPressed, stopGrabAtEdge, teeterAtEdge, teeterShieldAtEdge } from "./teeter";
import { beginCarryJump, limitCarrySpeed } from "./cargoCarry";
import {
  SHIELD_MIN_HOLD_FRAMES,
  SHIELD_PERFECT_ACTIVE_FRAMES,
  SHIELD_REFLECTOR_ACTIVE_FRAMES,
  SHIELD_RED_PARRY_FRAMES,
  SHIELD_RELEASE_LAG_FRAMES,
  bufferParryOption,
  decayShieldMotion,
  shieldDrain,
  shieldDrainShouldResume,
  clearPowershield,
  raiseShield,
} from "./shield";
import { beginShieldBreak } from "./shieldBreak";
import { advanceShieldTilt } from "./shieldTilt";
import { applyAutomaticSmashDirectionalInfluence, applySmashDirectionalInfluence, discardPendingSmashDirectionalInfluence } from "./smashDirectionalInfluence";
import * as stageSurfaces from "./stage";
import { endCannonPass, windPush } from "./stageHazards";
import { tauntPull } from "./taunt";
import * as sea from "./water";
import { checkBlastZone } from "./stocks";
import { advanceWallJump, leaveMainDeckBody, resolveSolidSurfaceContacts } from "./surfaces";
import { forwardRollTurnFrame, rollTravel } from "./geometry/rollTravel";
import { advanceTechInput, techContactWindow } from "./geometry/techInput";
import { cancelAttack, clearDownState } from "./transitions";
import { WORLD_UNITS_PER_MELEE_UNIT } from "./tuning";
import { aerialJumps, heavyFall, jumpBuffed, speedBuffed } from "./itemBuffs";

const FAST_FALL_DOWN_THRESHOLD = 0.6625000238418579;
/** the stick crosses this sideways to count as a fresh flick. */
const STICK_SMASH_DEADZONE_X = 0.25;
/** tumble ends on a flick at least this far sideways, on the frame it crosses the deadzone. */
const TUMBLE_EXIT_STICK_X = 0.800000011920929;
const STEERING_BITS = 16399;

export function readStickFrame(f: Fighter, input: Readonly<Controls>, horizontalStick: number): boolean {
  const { motion } = f;
  const downHeld = isDownHeld(input);
  motion.fastFallInputAge = downHeld ? (motion.fastFallDownHeld ? min(PLATFORM_DROP_INPUT_WINDOW, motion.fastFallInputAge + 1) : 0) : PLATFORM_DROP_INPUT_WINDOW;
  motion.fastFallDownHeld = downHeld;
  const stickSide = horizontalStick >= STICK_SMASH_DEADZONE_X ? 1 : horizontalStick <= -STICK_SMASH_DEADZONE_X ? -1 : 0;
  const tumbleExitFlick = stickSide !== 0 && stickSide !== motion.previousStickSide && Math.abs(horizontalStick) >= TUMBLE_EXIT_STICK_X;
  motion.stickSideAge = stickSide === 0 ? WALL_JUMP_FLICK_FRAMES : stickSide === motion.previousStickSide ? min(WALL_JUMP_FLICK_FRAMES, motion.stickSideAge + 1) : 0;
  readWavedashExit(f, stickSide, horizontalStick);
  platforms.trackPlatformInput(f, input);
  motion.previousStickSide = stickSide;
  if (input.direction !== 0) {
    motion.turnaroundSide = input.direction < 0 ? -1 : 1;
    motion.turnaroundAge = 0;
  } else {
    motion.turnaroundAge = min(TURNAROUND_SPECIAL_WINDOW_FRAMES + 1, motion.turnaroundAge + 1);
  }
  return tumbleExitFlick;
}

export function tickHitlag(f: Fighter): number {
  const { launch } = f;
  const hitlagBefore = launch.hitlag;
  launch.hitlag = max(0, launch.hitlag - 1);
  launch.hitlagEndAge = hitlagBefore > 0 ? 0 : min(16, launch.hitlagEndAge + 1);
  return hitlagBefore;
}

export function takeParryOption(f: Fighter, input: Readonly<Controls>): ParryBuffer {
  const { launch, shield } = f;
  let parryOption: ParryBuffer = ParryBuffer.none;
  if (launch.hitlag > 0) {
    if (shield.perfectActionFrames > 0) bufferParryOption(f, input);
  } else if (shield.parryBuffer !== ParryBuffer.none) {
    parryOption = shield.parryBuffer;
    shield.parryBuffer = ParryBuffer.none;
    shield.parryBufferDirection = 0;
  }
  return parryOption;
}

export function advanceTechAndRegrab(f: Fighter, input: Readonly<Controls>): void {
  const { launch } = f;
  advanceTechInput(f.tech, input.techPressed, launch.hitlag > 0);
  f.tech.window = techContactWindow(f.tech);
  if (launch.hitlag <= 0) {
    ageKnockback(f);
    f.ledge.regrab = max(0, f.ledge.regrab - 1);
  }
}

export function drainShieldEnergy(f: Fighter, world: Roster, slot: number, stage: number, input: Readonly<Controls>): boolean {
  const { launch, shield } = f;
  if (launch.hitlag <= 0 && shield.raised && shieldDrainShouldResume(f, shield.stun > 0)) {
    if (input.shield) shield.strength = input.shieldStrength;
    shield.energy = subtractFloat32(shield.energy, shieldDrain(shield.strength));
    if (shield.energy < 0) {
      shield.energy = 0.0;
      beginShieldBreak(world, slot);
      checkBlastZone(world, slot, stage);
      return true;
    }
  }
  return false;
}

export function applyFrameDirectionalInfluence(f: Fighter, world: Roster, slot: number, stage: number, matchFrame: number, input: Readonly<Controls>, hitlagBefore: number): void {
  const { launch, status } = f;
  if (hitlagBefore > 0 && launch.diPending) {
    if (launch.hitlag > 0) {
      applySmashDirectionalInfluence(world, slot, stage, matchFrame, input);
    } else {
      discardPendingSmashDirectionalInfluence(launch);
      if (!status.out) {
        applyDirectionalInfluence(f, input);
        applyAutomaticSmashDirectionalInfluence(world, slot, stage, matchFrame, input);
      }
    }
  }
}

export function beginJumpInput(f: Fighter, input: Readonly<Controls>, carrying: boolean, wallJumped: boolean, parryOption: ParryBuffer, wet: boolean, squatBeforeInput: number): boolean {
  const { jump, launch } = f;
  const waterJumped = wet && (input.jumpPressed || parryOption === ParryBuffer.jump) && !wallJumped && sea.beginWaterJump(f, input.direction);
  if ((input.jumpPressed || parryOption === ParryBuffer.jump) && !wallJumped && !waterJumped) beginJump(f, input.direction, input.shortHopPressed, heroSpecialJumps(f));
  if (carrying && input.jumpPressed) beginCarryJump(f, input.shortHopPressed);
  if (jump.squat > 0 && launch.hitlag === 0 && (f.character === Character.demonHunter || squatBeforeInput !== 1)) jump.held = jump.held && input.jumpHeld;
  return waterJumped;
}

export function beginDodgeInput(f: Fighter, input: Readonly<Controls>, parryOption: ParryBuffer, parryDirection: number): boolean {
  const { jump, motion } = f;
  if (input.airDodgePressed) {
    if (motion.grounded && jump.squat > 0) {
      jump.dodgeQueued = true;
      jump.dodgeX = input.dodgeX;
      jump.dodgeZ = input.dodgeZ;
    } else {
      beginAirDodge(f, input.dodgeX, input.dodgeZ, false);
    }
  }
  if (jump.dodgeQueued && (input.direction !== 0 || input.verticalDirection !== 0)) {
    jump.dodgeX = input.direction;
    jump.dodgeZ = input.verticalDirection;
  }
  const dodgePressed = input.groundDodgePressed && input.shield;
  if ((dodgePressed || parryOption === ParryBuffer.groundDodge) && !input.jumpPressed && canBeginGroundDodge(f)) {
    beginGroundDodge(f, dodgePressed ? input.groundDodgeDirection : parryDirection);
    return true;
  }
  return false;
}

export function applyTumbleExit(f: Fighter, tumbleExitFlick: boolean): void {
  const { motion, launch } = f;
  if (isTumbling(f) && !motion.grounded && launch.hitstun <= 0 && launch.hitlag <= 0 && tumbleExitFlick) {
    clearDownState(f);
    const airSpeed = speedBuffed(f, f.tuning.physics.airSpeed);
    motion.vx = max(-airSpeed, min(airSpeed, motion.vx));
  }
}

export function canSteerFrame(f: Fighter, authoredMotion: boolean, egg: ReturnType<typeof heroEgg>, dodgeActive: boolean, smashChargePaused: boolean): boolean {
  const { motion, launch, shield, attack, jump, dodge, down } = f;
  return !authoredMotion && egg === undefined && down.state === DownState.none && launch.hitstun <= 0 && (!dodge.airDodging || !dodgeActive) && !isGroundDodging(f)
    && shield.releaseLag <= 0 && f.landing.lag <= 0 && shield.stun <= 0 && jump.squat <= 0 && !smashChargePaused
    && (!motion.grounded || attack.cooldown <= 0) && f.surfaceRecovery.state !== SurfaceContact.techWall;
}

export function resolveCrouch(f: Fighter, input: Readonly<Controls>, direction: number, horizontalStick: number, carrying: boolean, wantsShield: boolean, canSteer: boolean): number {
  const { motion, attack, special } = f;
  motion.crouching = ((input.down || motion.crouching) && wantsCrouch(f, input, horizontalStick) || (motion.crouching && f.platform.dropConsumed && f.platform.downHeld && input.direction === 0)) && motion.grounded && canSteer && !wantsShield && !carrying
    && attack.style === undefined && special.action === SpecialAction.none
    && groundOptionOpen(f, GroundOption.crouch);
  if (!canSteer || wantsShield || !motion.grounded) clearDash(f);
  return motion.crouching ? 0 : direction;
}

export function steerMotion(f: Fighter, input: Readonly<Controls>, stage: number, direction: number, horizontalStick: number, wantsShield: boolean, canSteer: boolean, groundTakeoff: boolean, wet: boolean, carrying: boolean): number {
  const { motion } = f;
  let dashEntryDisplacementAdjustment = 0.0;
  if (canSteer) {
    if (!wantsShield) {
      observeActionDecision(STEERING_BITS);
      observeActionStart(STEERING_BITS);
    }
    const steerDirection = wantsShield ? 0 : direction;
    if (motion.grounded) {
      const previousGroundVelocity = motion.vx;
      if (advanceGroundMovement(f, steerDirection, input.walking || carrying, horizontalStick, stageSurfaces.floorFriction(stage, motion))) dashEntryDisplacementAdjustment = f32(previousGroundVelocity - motion.vx);
    } else if (steerDirection !== 0 && !groundTakeoff) {
      const driftStick = input.driftStickX ?? steerDirection;
      motion.vx = wet ? sea.swimVelocity(motion.vx, steerDirection) : airDriftVelocity(f, motion.vx, driftStick === 0 ? steerDirection : driftStick);
    }
  }
  return dashEntryDisplacementAdjustment;
}

export function dragFighterMotion(f: Fighter, stage: number, direction: number, wantsShield: boolean, canSteer: boolean, authoredMotion: boolean, groundTakeoff: boolean, carrying: boolean, dodgeActive: boolean): void {
  const { motion, launch, dodge } = f;
  const physics = f.tuning.physics;
  if (carrying) limitCarrySpeed(f);
  if (isGroundDodging(f) && dodge.groundDirection !== 0) {
    if (f.character === Character.demonHunter) {
      const moving = dodge.groundFrame >= GROUND_ROLL_MOVE_START && dodge.groundFrame <= GROUND_ROLL_MOVE_END;
      motion.vx = moving ? f32(GROUND_ROLL_SPEED * dodge.groundDirection) : 0.0;
    } else {
      motion.vx = f32(dodge.groundDirection * rollTravel(f.character, "roll", isForwardGroundRoll(f) ? "forward" : "back", dodge.groundFrame));
    }
  } else if (isGroundDodging(f)) {
    motion.vx = 0.0;
  } else if (!groundTakeoff && !authoredMotion && (!canSteer || wantsShield || direction === 0) && launch.hitstun <= 0 && (!dodgeActive || motion.grounded)) {
    const drag = motion.grounded ? restingTraction(f, stageSurfaces.floorTraction(physics.traction, stageSurfaces.floorFriction(stage, motion))) : physics.airFriction;
    motion.vx = motion.vx > 0 ? max(0.0, f32(motion.vx - drag)) : min(0.0, f32(motion.vx + drag));
  }
}

export function decayMotion(f: Fighter, stage: number, dodgeActive: boolean): void {
  const { motion } = f;
  decayKnockback(f, stageSurfaces.floorFriction(stage, motion));
  decayShieldMotion(f, stageSurfaces.floorFriction(stage, motion));
  if (dodgeActive && !motion.grounded) {
    motion.vx = f32(motion.vx * AIR_DODGE_DECAY);
    motion.vz = f32(motion.vz * AIR_DODGE_DECAY);
  }
}

export function applyVerticalMotion(f: Fighter, input: Readonly<Controls>, stage: number, matchFrame: number, drill: ReturnType<typeof attackFall>, egg: ReturnType<typeof heroEgg>, wet: boolean, waterJumped: boolean, dodgeActive: boolean, authoredHeight: boolean, groundTakeoff: boolean): void {
  const { motion, launch, shield, jump } = f;
  const physics = f.tuning.physics;
  const downHeld = isDownHeld(input);
  let buoyant = false;
  if (isGroundDodging(f) || (motion.grounded && jump.squat > 0)) {
    motion.vz = 0.0;
    motion.z = stageSurfaces.surfaceZAt(stage, motion.surface ?? 0, matchFrame, motion.x);
  } else if (wet && egg === undefined && !waterJumped && launch.hitstun <= 0 && !dodgeActive && !authoredHeight && drill?.speedZ === undefined) {
    buoyant = true;
    sea.applyBuoyancy(f);
  } else if ((!dodgeActive || motion.grounded) && !groundTakeoff && !authoredHeight) {
    closeParasol(f, downHeld);
    reopenParasol(f, input.verticalDirection > 0);
    startFastFall(f, input, downHeld);
    if (drill?.speedZ !== undefined) motion.vz = drill.speedZ;
    else if (egg !== undefined) motion.vz = -egg.fallSpeed;
    else if (motion.fastFalling) motion.vz = -heavyFall(f, f32(physics.fastFallSpeed * heroStatusFall(f)));
    else applyMeleeGravity(f, f32(heroStatusFall(f) * parasolFall(f)));
  }
  moveMeleeVerticalVelocity(f);
  moveMeleeZ(f, divideFloat32(launch.knockbackZ, WORLD_UNITS_PER_MELEE_UNIT));
  moveMeleeZ(f, divideFloat32(shield.recoilZ, WORLD_UNITS_PER_MELEE_UNIT));
  if (buoyant) sea.floatAtSurface(f);
}

export function advanceDownMotion(f: Fighter, world: Roster, slot: number, stage: number, matchFrame: number, input: Readonly<Controls>): boolean {
  const { motion } = f;
  const downOldX = motion.x;
  const downOldZ = motion.z;
  if (!advanceDownState(f, stage, matchFrame, input)) return false;
  resolveDownGroundContact(f, stage, matchFrame);
  motion.deltaX = f32(motion.x - downOldX);
  motion.deltaZ = f32(motion.z - downOldZ);
  checkBlastZone(world, slot, stage);
  return true;
}

export function startFastFall(f: Fighter, input: Readonly<Controls>, downHeld: boolean): void {
  const { motion, launch, down } = f;
  if (!motion.grounded && !motion.fastFalling && !f.platform.dropConsumed && downHeld && motion.fastFallInputAge < FAST_FALL_INPUT_WINDOW && input.direction === 0
    && down.state === DownState.none && launch.hitstun <= 0 && motion.vz < 0) {
    motion.fastFalling = true;
    motion.fastFallInputAge = PLATFORM_DROP_INPUT_WINDOW;
  }
}

export function isDownHeld(input: Readonly<Controls>): boolean {
  return (input.down ? 1.0 : 0.0) >= FAST_FALL_DOWN_THRESHOLD;
}

export function cancelJumpStates(f: Fighter, input: Readonly<Controls>): void {
  demonHunterJumpCancel(f);
  jumpCancelHeroSpecial(f, input);
}

