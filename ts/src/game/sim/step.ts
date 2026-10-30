



import { max, min } from "../core/numbers";
import { divideFloat32, roundToFloat32, subtractFloat32 } from "wisp/src/sim/binary32";
import { f32 } from "wisp/src/sim/f32";
import { Character, DownState, LedgeState, ParryBuffer, ShieldBreak, SpecialAction, SurfaceContact } from "./codes";
import {
  SPOT_DODGE_FRAMES,
  GROUND_ROLL_FRAMES,
  WALL_TECH_STARTUP_FRAMES,
  canAttack,
  canStartAttack,
  inGrabContext,
  isFloorTeching,
  isForwardGroundRoll,
  isGroundDodging,
  isTumbling,
} from "./conditions";
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
  TURNAROUND_SPECIAL_WINDOW_FRAMES,
  WALL_JUMP_FLICK_FRAMES,
  WALL_TECH_JUMP_INPUT_WINDOW_FRAMES,
} from "./fighter";
import { advanceGroundMovement, clearDash, readLandingExit, restingTraction, wantsCrouch } from "./groundMovement";
import { heroEgg, jumpCancelHeroSpecial } from "./specials/engine";
import { heroFloats, heroMotionHolds, heroMotionPassesPlatforms, heroSpecialJumps } from "./specials/heroMotion";
import { tickEmpowered } from "./specials/empowered";
import { carryHeroStatus, heroStatusFall } from "./heroStatus";
import { closeParasol, endParasolAerial, parasolFall, reopenParasol } from "./parasol";
import { hopHeroStatus } from "./hexHop";
import { demonHunterAuthoredMotion, demonHunterHoldsHeight, demonHunterJumpCancel } from "./specials";
import { AIR_DODGE_DECAY, AIR_DODGE_DECAY_FRAMES, beginAirDodge, beginGroundDodge, beginJump, canBeginGroundDodge, endFinishedAirDodge } from "./jumpsAndDodges";
import { ageKnockback, applyDirectionalInfluence, decayKnockback } from "./knockback";
import { advanceLedge, catchWavedashLedge, wavedashLedgeSide } from "./ledge";
import { EdgePass, passThroughEdge, rideWall, teleportsThisFrame } from "./edgeRecovery";
import { DOWN_ATTACK_FRAMES, EARLY_ASCENT_GRAB_FRAMES, SMASH_MAX_HOLD_FRAMES, attackFall, attackStartupFrames, isSmashAttack, skipFlurryWhenReleased, smashChargeFrame } from "./moves";
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
import * as platforms from "./platformMoves";
import { type Controls, type Roster, fighterAt } from "./roster";
import { travelBeforeBodies, travelBeforeLedge } from "./travelStop";
import { canTeeter, grabHoldsEdge, shieldPressed, stopGrabAtEdge, teeterAtEdge, teeterShieldAtEdge } from "./teeter";
import { beginCarryJump, carryThrowRequested, isCarrying, limitCarrySpeed, lowerCarryJump } from "./cargoCarry";
import { moveTravelStep } from "./heroMoves";
import {
  advanceGuard,
  advanceShieldInputClocks,
  bufferParryOption,
  decayShieldMotion,
  regenerateShield,
  shieldDrain,
  shieldDrainShouldResume,
  clearPowershield,
} from "./shield";
import { advanceShieldBreak, beginShieldBreak } from "./shieldBreak";
import { applyAutomaticSmashDirectionalInfluence, applySmashDirectionalInfluence, discardPendingSmashDirectionalInfluence, renewSmashDirectionalInfluenceString } from "./smashDirectionalInfluence";
import * as stageSurfaces from "./stage";

import { endCannonPass, inStageCannon, windPush } from "./stageHazards";
import { tauntPull } from "./taunt";
// One local for the sea: this module is near Lua's 200-local limit.
import * as sea from "./water";
import { stickX } from "./stick";
import { respawnFighter } from "./respawn";
import { checkBlastZone } from "./stocks";
import { advanceSurfaceRecovery, advanceWallJump, leaveMainDeckBody, resolveSolidSurfaceContacts } from "./surfaces";
import { forwardRollTurnFrame, rollTravel } from "./geometry/rollTravel";
import { advanceTechInput, techContactWindow } from "./geometry/techInput";
import { freezeMinimumFrames, cancelAttack, clearDownState, clearOwnedFreezeTrap, thawFighter } from "./transitions";
import { advanceMash } from "./mash";
import { WORLD_UNITS_PER_MELEE_UNIT } from "./tuning";
import { aerialJumps, heavyFall, jumpBuffed, speedBuffed } from "./itemBuffs";
import { mutableFreezeTrap } from "./fighterRest";
import { advancePetrify } from "./gaze";
import {
  advanceDownMotion,
  advanceTechAndRegrab,
  applyFrameDirectionalInfluence,
  applyTumbleExit,
  applyVerticalMotion,
  beginDodgeInput,
  beginJumpInput,
  canSteerFrame,
  cancelJumpStates,
  decayMotion,
  dragFighterMotion,
  drainShieldEnergy,
  readStickFrame,
  resolveCrouch,
  steerMotion,
  takeParryOption,
  tickHitlag,
} from "./motionSteps";

function attackStartupTravel(world: Roster, slot: number, stage: number, matchFrame: number): number {
  const f = fighterAt(world, slot);
  const move = f.attack.style === undefined ? undefined : f.tuning.moves?.normals[f.attack.style];
  const step = move === undefined || !f.motion.grounded || f.attack.smashCharging ? undefined : moveTravelStep(move, f.attack.frame);
  if (step === undefined) return 0.0;
  const before = travelBeforeBodies(world, slot, step, move?.travelStopsAtBody === true);
  const distance = move?.travelStopsAtLedge === true ? travelBeforeLedge(f, stage, matchFrame, before) : before;
  return f32(distance * f.facing);
}


export function advanceFighter(world: Roster, slot: number, stage: number, input: Readonly<Controls>, respawnX: number, matchFrame = 0): void {
  advanceFighterMotion(world, slot, stage, matchFrame, input, respawnX);
  regenerateShield(fighterAt(world, slot));
}


function advanceOut(world: Roster, slot: number, respawnX: number): boolean {
  const { status } = fighterAt(world, slot);
  if (!status.out) return false;
  if (status.stocks <= 0) return true;
  status.respawn--;
  if (status.respawn <= 0) respawnFighter(world, slot, respawnX);
  return true;
}


function advanceFreeze(f: Fighter, input: Readonly<Controls>): boolean {
  const { status } = f;
  advancePetrify(f);
  const trap = f.freezeTrap;
  const wasFrozen = status.frozenFrames > 0;
  if (status.freezeImmunityFrames > 0) status.freezeImmunityFrames--;
  if (wasFrozen) {
    const remaining = advanceMash(f.grab, input, status.frozenFrames, freezeMinimumFrames(status.damage));
    if (remaining === 0) thawFighter(f);
    else status.frozenFrames = remaining;
  }
  if (trap.cooldown > 0) {
    const cooling = mutableFreezeTrap(f);
    cooling.cooldown--;
  }
  if (trap.life > 0) {
    const live = mutableFreezeTrap(f);
    live.life--;
    if (live.arming > 0 && live.surface !== undefined) live.arming--;
    if (live.life === 0) clearOwnedFreezeTrap(f);
  }
  return wasFrozen;
}


function endFinishedDownStates(f: Fighter): void {
  const { down } = f;
  if (isFloorTeching(f) && down.frame >= (down.state === DownState.tech ? TECH_IN_PLACE_FRAMES : TECH_ROLL_FRAMES)) clearDownState(f);
  else if (down.state === DownState.stand && down.frame >= DOWN_STAND_FRAMES) clearDownState(f);
  else if (down.state === DownState.roll && down.frame >= DOWN_ROLL_FRAMES) clearDownState(f);
  else if (down.state === DownState.attack && down.frame >= DOWN_ATTACK_FRAMES) clearDownState(f);
}


function advanceActionClocks(f: Fighter, input: Readonly<Controls>): boolean {
  const { attack, special } = f;
  let smashChargePaused = false;
  if (attack.smashCharging) {
    if (f.motion.grounded && input.attackHeld && attack.smashChargeFrames < SMASH_MAX_HOLD_FRAMES) {
      attack.smashChargeFrames++;
      smashChargePaused = true;
    } else {
      attack.smashCharging = false;
      attack.smashChargeAllowed = false;
      attack.strongUp = false;
    }
  } else if (f.motion.grounded && attack.style !== undefined && attack.smashChargeAllowed && isSmashAttack(attack.style)
    && input.attackHeld && attack.frame >= smashChargeFrame(attack.style, f.tuning.moves)) {
    attack.smashCharging = true;
    attack.smashChargeFrames = 1;
    smashChargePaused = true;
  }
  if (smashChargePaused) return true;
  attack.cooldown = max(0, attack.cooldown - 1);
  if (special.lockFrames > 0) special.lockFrames--;
  const cooldowns = special.cooldowns;
  for (let action = 1; action < cooldowns.length; action++) {

    const remaining = cooldowns[action] ?? 0;
    if (remaining !== 0) cooldowns[action] = max(0, remaining - 1);
  }
  tickEmpowered(f);
  if (attack.style !== undefined) {
    skipFlurryWhenReleased(attack, input.attackHeld, f.tuning.moves);
    attack.frame++;
    if (attack.frame >= attack.duration) {
      attack.style = undefined;
      endParasolAerial(f);
      attack.frame = 0;
      attack.hit = false;
      attack.dashGrab = false;
      attack.pivotGrab = false;
      attack.smashCharging = false;
      attack.smashChargeFrames = 0;
      attack.smashChargeAllowed = false;
      attack.strongUp = false;
    }
  }
  return false;
}


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


function slideOffEdge(f: Fighter): void {
  const { shield, landing, launch } = f;
  if (launch.hitstun > 0 || f.down.state !== DownState.none || inGrabContext(f) || f.status.out) return;
  if (shield.raised || shield.stun > 0 || shield.pushbackX !== 0) {
    shield.raised = false;
    shield.stun = 0;
    shield.heldFrames = 0;
    shield.pushbackX = 0.0;
    shield.recoilX = 0.0;
    shield.recoilZ = 0.0;
    clearPowershield(f);
    f.special.fall = true;
    return;
  }
  landing.lag = 0;
  if (f.attack.style !== undefined) cancelAttack(f);
}

function leaveSurface(f: Fighter, world: Roster, slot: number, stage: number, input: Readonly<Controls>): void {
  const { motion, jump } = f;
  const catchSide = wavedashLedgeSide(f, stage, input);
  if (motion.grounded) {
    jump.remaining = min(jump.remaining, aerialJumps(f));
    slideOffEdge(f);
  }
  motion.grounded = false;
  motion.surface = undefined;
  clearDash(f);
  catchWavedashLedge(world, slot, stage, catchSide);
}

function moveHorizontally(f: Fighter, stage: number, matchFrame: number, dashEntryDisplacementAdjustment: number): void {
  const { motion, launch, shield, dodge } = f;
  if (isGroundDodging(f) && dodge.groundDirection !== 0) {
    const proposedX = f32(motion.x + totalVelocityX(f));
    const deck = motion.surface ?? 0;
    const left = stageSurfaces.surfaceLeft(stage, deck, matchFrame);
    const right = stageSurfaces.surfaceRight(stage, deck, matchFrame);
    motion.x = max(left, min(right, proposedX));
    if ((dodge.groundDirection < 0 && motion.x === left) || (dodge.groundDirection > 0 && motion.x === right)) {
      motion.vx = 0.0;
      launch.knockbackX = 0.0;
      launch.groundKnockbackX = 0.0;
    }
    return;
  }
  if (motion.grounded) {
    const ground = addMeleeWorldValues(f32(motion.vx + dashEntryDisplacementAdjustment), shield.pushbackX);

    const line = motion.surface === undefined ? undefined : stageSurfaces.surfaceLine(stage, motion.surface);
    moveMeleeX(f, line === undefined ? ground : f32(ground * stageSurfaces.groundLineCosine(line, motion.x)));
  } else {
    moveMeleeX(f, motion.vx);
  }
  moveMeleeX(f, launch.knockbackX);
  moveMeleeX(f, shield.recoilX);
}









function landingDeck(f: Fighter, stage: number, matchFrame: number, oldX: number, oldZ: number, carried: number | undefined): number | undefined {
  const { motion } = f;

  let rise: number | undefined;
  let landing: number | undefined;
  let landingZ = 0.0;
  const passesPlatforms = heroMotionPassesPlatforms(f);
  for (let i = 0; i < stageSurfaces.surfaceCount(stage); i++) {
    if (passesPlatforms && i !== 0) continue;
    const line = stageSurfaces.surfaceLine(stage, i);
    if (line !== undefined) {
      const lineZ = slopedLandingZ(line, i === carried, oldX, oldZ, motion.x, motion.z);
      if (lineZ === undefined || (landing !== undefined && lineZ <= landingZ)) continue;
      if (rise === undefined) rise = totalVelocityZ(f);
      if (rise > 0) continue;
      landing = i;
      landingZ = lineZ;
      continue;
    }
    const platformZ = stageSurfaces.surfaceZ(stage, i, matchFrame);
    const follows = i !== carried && stageSurfaces.surfaceMoves(stage, i);
    const fromZ = follows ? f32(oldZ + stageSurfaces.surfaceShiftZ(stage, i, matchFrame)) : oldZ;
    if (!(fromZ >= platformZ && motion.z <= platformZ)) continue;
    if (rise === undefined) rise = totalVelocityZ(f);
    if ((follows ? f32(rise - stageSurfaces.surfaceShiftZ(stage, i, matchFrame)) : rise) > 0) continue;
    const fromX = follows ? f32(oldX + stageSurfaces.surfaceShiftX(stage, i, matchFrame)) : oldX;
    const fraction = fromZ === motion.z ? 1.0 : f32(f32(fromZ - platformZ) / f32(fromZ - motion.z));
    const crossingX = f32(fromX + f32(f32(motion.x - fromX) * fraction));
    const left = stageSurfaces.surfaceLeft(stage, i, matchFrame);
    const right = stageSurfaces.surfaceRight(stage, i, matchFrame);
    if (crossingX >= left && crossingX <= right && motion.x >= left && motion.x <= right) {
      if (landing === undefined || platformZ > landingZ) {
        landing = i;
        landingZ = platformZ;
      }
    }
  }
  return landing;
}
export function advanceShieldFrameTimers(f: Fighter, input: Readonly<Controls>, carrying: boolean): boolean {
  const { shield, dodge, status } = f;
  const forcedShield = shield.raised && shield.stun > 0;
  shield.stun = max(0, shield.stun - 1);
  status.invincible = max(0, status.invincible - 1);
  if (dodge.airDodging) dodge.airFrame = min(AIR_DODGE_DECAY_FRAMES, dodge.airFrame + 1);
  dodge.airMotionFrames = max(0, dodge.airMotionFrames - 1);
  shield.releaseLag = max(0, shield.releaseLag - 1);
  return !carrying && advanceGuard(f, input, forcedShield);
}

export function advanceActionFrame(f: Fighter, input: Readonly<Controls>): boolean {
  let smashChargePaused = false;
  if (f.launch.hitlag <= 0) {
    f.landing.lag = max(0, f.landing.lag - 1);
    smashChargePaused = advanceActionClocks(f, input);
  }
  return smashChargePaused;
}

export function tickRecoveryClocks(f: Fighter): void {
  if (f.launch.hitlag <= 0) {
    f.surfaceRecovery.reflectCooldown = max(0, f.surfaceRecovery.reflectCooldown - 1);
    endFinishedDownStates(f);
    endFinishedAirDodge(f);
  }
}

export function moveAlongSurface(f: Fighter, stage: number, matchFrame: number, horizontalStick: number, dashEntry: number, canSteer: boolean, wantsShield: boolean, groundTakeoff: boolean): void {
  const teeters = !wantsShield && !groundTakeoff && !isGroundDodging(f) && canTeeter(f, canSteer);
  const pushedOnShield = shieldPressed(f);
  const grabHolds = grabHoldsEdge(f);
  moveHorizontally(f, stage, matchFrame, dashEntry);
  if (grabHolds) stopGrabAtEdge(f, stage, matchFrame);
  else if (teeters) teeterAtEdge(f, stage, matchFrame, horizontalStick, canSteer);
  else if (pushedOnShield) teeterShieldAtEdge(f, stage, matchFrame);
}

export function resolveSurfaceMotion(f: Fighter, world: Roster, slot: number, stage: number, matchFrame: number, input: Readonly<Controls>, oldX: number, oldZ: number, carried: number | undefined, horizontalStick: number): void {
  const { motion } = f;
  if (!isGroundDodging(f)) moveMeleeX(f, windPush(stage, matchFrame, motion.x, motion.z));
  moveMeleeX(f, tauntPull(world, slot));
  const frameDeltaX = f32(motion.x - oldX);
  const frameDeltaZ = f32(motion.z - oldZ);
  const edge = passThroughEdge(world, slot, stage, oldX, oldZ);
  let wallSide = edge === EdgePass.none ? resolveSolidSurfaceContacts(f, stage, oldX, oldZ, input) : 0;
  rideWall(f, wallSide, frameDeltaX, frameDeltaZ, oldX, oldZ);

  const ascending = edge === EdgePass.none && !teleportsThisFrame(f) && platforms.mountPlatform(f, stage, matchFrame, input);
  const landing = edge === EdgePass.land ? 0 : edge !== EdgePass.none || ascending ? undefined : landingDeck(f, stage, matchFrame, oldX, oldZ, carried);
  const contact = platforms.passesThroughPlatform(f, stage, input, landing);
  if (landing !== undefined && !contact) {
    finishLanding(f, stage, matchFrame, input, landing, false);
  } else if (!ascending && !contact) {
    const bodySide = leaveMainDeckBody(f, stage);
    if (wallSide === 0 && f32(bodySide * frameDeltaX) > 0) wallSide = bodySide;
    leaveSurface(f, world, slot, stage, input);
  }
  if (motion.grounded) {
    f.surfaceRecovery.wallJumpsUsed = 0;
  } else {
    motion.crouching = false;
    advanceWallJump(f, wallSide, frameDeltaX, horizontalStick);
  }
  endCannonPass(f, stage);
  checkBlastZone(world, slot, stage);
  motion.deltaX = f32(motion.x - oldX);
  motion.deltaZ = f32(motion.z - oldZ);
}

export function advanceFighterMotion(world: Roster, slot: number, stage: number, matchFrame: number, input: Readonly<Controls>, respawnX: number): void {
  const f = fighterAt(world, slot);
  const { motion, launch, shield, attack, jump, dodge, status } = f;
  motion.deltaX = 0.0;
  motion.deltaZ = 0.0;
  if (advanceOut(world, slot, respawnX)) return;
  renewSmashDirectionalInfluenceString(f);
  if (inStageCannon(f)) return;
  const carried = motion.grounded ? motion.surface : undefined;
  jump.inputAge = input.jumpPressed ? 0 : min(WALL_TECH_JUMP_INPUT_WINDOW_FRAMES, jump.inputAge + 1);
  if (advanceFreeze(f, input)) {
    checkBlastZone(world, slot, stage);
    return;
  }
  const horizontalStick = stickX(input);
  const tumbleExitFlick = readStickFrame(f, input, horizontalStick);
  const hitlagBefore = tickHitlag(f);
  const parryDirection = shield.parryBufferDirection;
  const parryOption = takeParryOption(f, input);
  advanceTechAndRegrab(f, input);
  if (f.ledge.state !== LedgeState.none) {
    advanceLedge(world, slot, stage, input);
    return;
  }
  if (shield.breakState !== ShieldBreak.none && advanceShieldBreak(world, slot, stage, matchFrame, input)) return;
  if (drainShieldEnergy(f, world, slot, stage, input)) return;
  tickRecoveryClocks(f);
  const wallJumped = advanceSurfaceRecovery(f, input);
  const wallTechStartup = f.surfaceRecovery.state === SurfaceContact.techWall && f.surfaceRecovery.frame < WALL_TECH_STARTUP_FRAMES;
  applyFrameDirectionalInfluence(f, world, slot, stage, matchFrame, input, hitlagBefore);
  if (status.out) return;
  const carrying = isCarrying(f);
  if (wallTechStartup || (inGrabContext(f) && !carrying)) {
    if (launch.hitlag <= 0) status.invincible = max(0, status.invincible - 1);
    checkBlastZone(world, slot, stage);
    return;
  }
  const smashChargePaused = advanceActionFrame(f, input);
  if (f.grab.target !== undefined && !carrying) {
    checkBlastZone(world, slot, stage);
    return;
  }
  if (launch.hitlag <= 0) launch.hitstun = max(0, launch.hitstun - 1);
  if (launch.hitstun === 0) launch.throwHitstun = false;
  const squatBeforeInput = jump.squat;
  if (input.jumpPressed) cancelJumpStates(f, input);
  const wet = sea.wet(f, stage);
  const waterJumped = beginJumpInput(f, input, carrying, wallJumped, parryOption, wet, squatBeforeInput);
  const groundDodgeStarted = beginDodgeInput(f, input, parryOption, parryDirection);
  const groundTakeoff = advanceJumpSquat(f, input, squatBeforeInput);
  if (carrying && groundTakeoff) lowerCarryJump(f);
  if (launch.hitlag > 0) return;
  advanceShieldInputClocks(f, input);
  advanceGroundDodge(f, groundDodgeStarted);
  checkBlastZone(world, slot, stage);
  if (status.out) return;
  if (advanceDownMotion(f, world, slot, stage, matchFrame, input)) return;
  const dodgeActive = dodge.airMotionFrames > 0;
  const wantsShield = advanceShieldFrameTimers(f, input, carrying);
  const direction = carrying && carryThrowRequested(f, input) ? 0 : input.direction;
  applyTumbleExit(f, tumbleExitFlick);
  hopHeroStatus(f, slot, stage, matchFrame);
  const authoredMotion = carryHeroStatus(f) || heroMotionHolds(f) || demonHunterAuthoredMotion(f);
  const authoredHeight = authoredMotion || demonHunterHoldsHeight(f) || heroFloats(f);
  const egg = heroEgg(f);
  const canSteer = canSteerFrame(f, authoredMotion, egg, dodgeActive, smashChargePaused);
  const moveDirection = resolveCrouch(f, input, direction, horizontalStick, carrying, wantsShield, canSteer);
  const dashEntryDisplacementAdjustment = steerMotion(f, input, moveDirection, horizontalStick, wantsShield, canSteer, groundTakeoff, wet, carrying);
  dragFighterMotion(f, moveDirection, wantsShield, canSteer, authoredMotion, groundTakeoff, carrying, dodgeActive);
  platforms.dropFromPlatform(f, stage, matchFrame, input);
  const oldX = motion.x;
  const oldZ = motion.z;
  const dashEntry = f32(dashEntryDisplacementAdjustment + attackStartupTravel(world, slot, stage, matchFrame));
  decayMotion(f, dodgeActive);
  const drill = motion.grounded ? undefined : attackFall(attack.style, attack.frame, f.tuning.moves);
  moveAlongSurface(f, stage, matchFrame, horizontalStick, dashEntry, canSteer, wantsShield, groundTakeoff);
  applyVerticalMotion(f, input, stage, matchFrame, drill, egg, wet, waterJumped, dodgeActive, authoredHeight, groundTakeoff);
  resolveSurfaceMotion(f, world, slot, stage, matchFrame, input, oldX, oldZ, carried, horizontalStick);
}
