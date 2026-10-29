
import { max, min } from "../core/numbers";
import { roundToFloat32 } from "wisp/src/sim/binary32";
import { f32 } from "wisp/src/sim/f32";
import { Character, DamageLanding, DownState, ParasolState, SpecialAction } from "./codes";
import { isFloorTeching, isTumbling } from "./conditions";
import { type Fighter } from "./fighter";
import { clearDash, landWavedash } from "./groundMovement";
import { MAX_GROUNDED_KNOCKBACK_ON_LANDING, airborneDamageLandingReaction, decayKnockback } from "./knockback";
import { RIFLEMAN_BLASTER_AIR_FRAMES, RIFLEMAN_BLASTER_LANDING_LAG, attackLandingLag, isAerialAttack, landsInAutoCancel, landsIntoAttack } from "./moves";
import { clearMotionValue, setWorldMotionValue, totalVelocityX } from "./motion";
import type { Controls } from "./roster";
import { surfaceCount, surfaceLeft, surfaceLine, surfaceRight, surfaceZAt } from "./stage";

import { rollTravel } from "./geometry/rollTravel";
import { beginDownState, cancelAttack, clearDownState } from "./transitions";
import { FEL_RUSH_IN_PROGRESS } from "./felRushAirtime";
import { LEDGE_TETHER_BITS } from "./ledgeTetherAirtime";
import { WORLD_UNITS_PER_MELEE_UNIT } from "./tuning";
import { squareRoot } from "./warcraftMath";
import { meleeAtan2 } from "../core/math/meleeScalarMath";
import { stickX, stickZ } from "./stick";
import { SURFACE_REFLECT_ATTENUATION, SURFACE_REFLECT_COOLDOWN_FRAMES, SURFACE_REFLECT_SPEED_THRESHOLD } from "./surfaces";
import { carriesChargeAcrossLanding, landHeroSpecial } from "./specials/heroForms";
import { heroEgg } from "./specials/engine";
import { isHeroSpecialAction, runningHeroSpecial } from "./specials/runningMove";
import { landsBeforeSwing } from "./specials/landing";
import { EYE_BEAM_AIR_FORM, EYE_BEAM_LANDING_LAG } from "./eyeBeam";
import { aerialJumps, groundedJumps } from "./itemBuffs";

export const AIR_DODGE_LANDING_LAG = 10;
export const EMPTY_LANDING_LAG = 4;
export const RIFLEMAN_RECOVERY_LANDING_LAG = EMPTY_LANDING_LAG + 10;
export const GROUND_ROLL_SPEED = 8.0;
export const GROUND_ROLL_MOVE_START = 4;
export const GROUND_ROLL_MOVE_END = 19;
export const TECH_IN_PLACE_FRAMES = 26;
export const TECH_ROLL_FRAMES = 40;
export const DOWN_BOUND_FRAMES = 26;
export const DOWN_WAIT_FRAMES = 220;
export const DOWN_STAND_FRAMES = 30;
export const DOWN_ROLL_FRAMES = 35;
export const DOWN_DAMAGE_FRAMES = 13;

export const DOWN_DAMAGE_RESET_THRESHOLD = 7.0;
/** stick tilt that rolls or stands from a down state. */
const GETUP_ROLL_STICK_X = 0.20000000298023224;
const GETUP_STAND_STICK_Z = 0.20000000298023224;
/** the stick angle above horizontal that separates a get-up roll from standing. */
const GETUP_STICK_ANGLE = 0.8726646304130554;
/** stick tilt that turns a floor tech into a tech roll. */
const TECH_ROLL_STICK_X = 0.20000000298023224;


function applyDownRollTravel(f: Fighter, stage: number, matchFrame: number): void {
  const { down, motion } = f;
  if (down.state !== DownState.roll && down.state !== DownState.techRoll) return;
  let distance = 0.0;
  if (f.character === Character.demonHunter) {
    if (down.frame >= GROUND_ROLL_MOVE_START && down.frame <= GROUND_ROLL_MOVE_END) distance = GROUND_ROLL_SPEED;
  } else {
    const kind = down.state === DownState.techRoll ? "tech" : down.faceUp ? "faceUpGetup" : "faceDownGetup";
    distance = rollTravel(f.character, kind, down.direction === f.facing ? "forward" : "back", down.frame);
  }
  const deck = motion.surface ?? 0;
  motion.x = max(surfaceLeft(stage, deck, matchFrame), min(surfaceRight(stage, deck, matchFrame), f32(motion.x + f32(down.direction * distance))));
}


function damageLandingReaction(f: Fighter): DamageLanding {
  const launchX = roundToFloat32(f32(f.launch.knockbackX / WORLD_UNITS_PER_MELEE_UNIT));
  const launchZ = roundToFloat32(f32(f.launch.knockbackZ / WORLD_UNITS_PER_MELEE_UNIT));
  const squaredSpeed = roundToFloat32(f32(roundToFloat32(f32(launchX * launchX)) + roundToFloat32(f32(launchZ * launchZ))));
  return airborneDamageLandingReaction(roundToFloat32(squareRoot(squaredSpeed)));
}


function airShotLandingLag(special: Readonly<Fighter["special"]>): number | undefined {
  if (special.action === SpecialAction.riflemanBlaster && special.duration === RIFLEMAN_BLASTER_AIR_FRAMES) return RIFLEMAN_BLASTER_LANDING_LAG;
  if (special.action === SpecialAction.demonHunterEyeBeam && special.form === EYE_BEAM_AIR_FORM) return EYE_BEAM_LANDING_LAG;
  return undefined;
}


function emptyLandingLag(f: Readonly<Fighter>): number {
  const recovering = f.character === Character.rifleman && (f.special.fall || f.special.action === SpecialAction.riflemanRecovery);
  return recovering ? RIFLEMAN_RECOVERY_LANDING_LAG : EMPTY_LANDING_LAG;
}


function landsWithoutLag(f: Readonly<Fighter>): boolean {
  return airShotLandingLag(f.special) === 0 || runningHeroSpecial(f)?.landingLag === 0 || carriesChargeAcrossLanding(f)
    || landsBeforeSwing(runningHeroSpecial(f), f.special.frame);
}


function landAirShot(f: Fighter): void {
  const { special } = f;
  const lag = airShotLandingLag(special);
  if (lag === undefined) return;
  special.action = SpecialAction.none;
  special.frame = 0;
  special.lockFrames = 0;
  f.attack.cooldown = 0;
  f.landing.lag = max(f.landing.lag, lag);
}


function reboundsOffFloor(f: Fighter, fromAsdi: boolean): boolean {
  const { motion, launch, surfaceRecovery: recovery } = f;
  return !motion.grounded && !fromAsdi && isTumbling(f) && f.tech.window <= 0 && recovery.reflectCooldown === 0 && -launch.knockbackZ > SURFACE_REFLECT_SPEED_THRESHOLD;
}

function reboundOffFloor(f: Fighter, stage: number, matchFrame: number, landing: number): void {
  const { motion, launch, surfaceRecovery: recovery } = f;
  const combinedX = f32(motion.vx + launch.knockbackX);
  const combinedZ = f32(motion.vz + launch.knockbackZ);
  launch.knockbackX = f32(combinedX * SURFACE_REFLECT_ATTENUATION);
  launch.knockbackZ = f32(-combinedZ * SURFACE_REFLECT_ATTENUATION);
  motion.vx = 0.0;
  motion.vz = 0.0;
  clearMotionValue(motion.meleeVelocityZ);
  motion.fastFalling = false;
  motion.z = surfaceZAt(stage, landing, matchFrame, motion.x);
  setWorldMotionValue(motion.meleeZ, motion.z);
  f.facing = launch.knockbackX < 0 ? -1 : 1;
  recovery.reflectCooldown = SURFACE_REFLECT_COOLDOWN_FRAMES;
}

function hatchEgg(f: Fighter): boolean {
  const egg = heroEgg(f);
  if (egg === undefined) return false;
  f.special.egg = false;
  f.launch.hitstun = 0;
  f.launch.throwHitstun = false;
  f.tech.window = 0;
  clearDownState(f);
  f.landing.lag = max(f.landing.lag, egg.hatchFrames);
  return true;
}

export function finishLanding(f: Fighter, stage: number, matchFrame: number, input: Readonly<Controls>, landing: number, fromAsdi: boolean): void {
  const { motion, launch, landing: landingState, dodge } = f;
  if (reboundsOffFloor(f, fromAsdi)) {
    reboundOffFloor(f, stage, matchFrame, landing);
    return;
  }
  motion.fastFalling = false;
  const wasGrounded = motion.grounded;
  const damageLanding = !wasGrounded && !fromAsdi && launch.hitstun > 0 && !isTumbling(f) ? damageLandingReaction(f) : undefined;
  if (!motion.grounded) clearDash(f);
  if (!motion.grounded && !dodge.airDodging && !isAerialAttack(f.attack.style) && f.down.state === DownState.none && launch.hitstun <= 0 && !fromAsdi && !landsWithoutLag(f)) {
    landingState.lag = max(landingState.lag, emptyLandingLag(f));
  }
  dodge.airUsed = false;
  dodge.airMotionFrames = 0;
  f.ledge.grabs = 0;
  if (dodge.airDodging) {
    landingState.lag = AIR_DODGE_LANDING_LAG;
    landWavedash(f);
    dodge.airDodging = false;
    dodge.airFrame = 0;
  }
  const { attack } = f;
  const landingHit = attack.style === undefined ? undefined : f.tuning.moves?.normals[attack.style]?.landingHit;
  if (landingHit !== undefined && attack.frame >= landingHit.firstFrame) {

  } else if (landingHit !== undefined && !wasGrounded && landsIntoAttack(attack.style, attack.frame, f.tuning.moves)) {

    attack.frame = landingHit.firstFrame;
    attack.duration = landingHit.totalFrames;
    attack.cooldown = landingHit.totalFrames - landingHit.firstFrame;
  } else if (isAerialAttack(attack.style)) {
    const autoCancelled = landsInAutoCancel(f.character, attack.style, attack.frame, f.tuning.moves);
    landingState.lag = max(landingState.lag, autoCancelled ? EMPTY_LANDING_LAG : attackLandingLag(attack.style, f.tuning.moves));
    cancelAttack(f);
  }
  motion.grounded = true;
  motion.surface = landing;
  motion.z = surfaceZAt(stage, landing, matchFrame, motion.x);
  motion.vz = 0.0;
  setWorldMotionValue(motion.meleeZ, motion.z);
  clearMotionValue(motion.meleeVelocityZ);
  launch.knockbackZ = 0.0;
  if (!wasGrounded && launch.groundKnockbackX === 0) {
    launch.groundKnockbackX = max(-MAX_GROUNDED_KNOCKBACK_ON_LANDING, min(MAX_GROUNDED_KNOCKBACK_ON_LANDING, launch.knockbackX));
    launch.knockbackX = launch.groundKnockbackX;
  }
  if (!wasGrounded && !landsBeforeSwing(runningHeroSpecial(f), f.special.frame)) landHeroSpecial(f);
  if (!wasGrounded) landAirShot(f);
  f.special.fall = false;
  f.special.parasol = ParasolState.none;
  if (!isHeroSpecialAction(f.special.action)) f.special.airtimeUses = f.tuning.specials === undefined ? f.special.airtimeUses & FEL_RUSH_IN_PROGRESS : 0;
  f.special.airtimeUses &= ~LEDGE_TETHER_BITS;
  if (f.jump.squat <= 0) f.jump.remaining = groundedJumps(f);
  if (hatchEgg(f)) return;
  if (isTumbling(f)) {
    const launchDirection = totalVelocityX(f) < 0 ? -1 : 1;
    launch.hitstun = 0;
    launch.throwHitstun = false;
    if (f.tech.window > 0) {
      const x = stickX(input);
      const techDirection = Math.abs(x) < TECH_ROLL_STICK_X ? 0 : x < 0 ? -1 : 1;
      f.tech.window = 0;
      beginDownState(f, techDirection === 0 ? DownState.tech : DownState.techRoll, techDirection);
      applyDownRollTravel(f, stage, matchFrame);

      if (surfaceLine(stage, landing) !== undefined) {
        motion.z = surfaceZAt(stage, landing, matchFrame, motion.x);
        setWorldMotionValue(motion.meleeZ, motion.z);
      }
    } else {
      beginDownState(f, DownState.bound, launchDirection);
    }
  } else if (damageLanding === DamageLanding.knockdown) {
    launch.hitstun = 0;
    launch.throwHitstun = false;
    beginDownState(f, DownState.bound, totalVelocityX(f) < 0 ? -1 : 1);
  } else if (damageLanding === DamageLanding.normal) {

    if (!launch.throwHitstun) launch.hitstun = 0;
    landingState.lag = max(landingState.lag, EMPTY_LANDING_LAG);
  } else if (fromAsdi) {
    launch.hitstun = 0;
    launch.throwHitstun = false;
  }
}

function startDownWait(f: Fighter, remainingFrames: number): void {
  const { down } = f;
  down.state = DownState.wait;
  down.frame = 0;
  down.direction = 0;
  down.waitRemaining = max(0, remainingFrames);
  down.attackQueued = false;
}


function stickRollDirection(input: Readonly<Controls>): number {
  const x = stickX(input);
  if (Math.abs(x) < GETUP_ROLL_STICK_X || meleeAtan2(stickZ(input), Math.abs(x)) >= GETUP_STICK_ANGLE) return 0;
  return x < 0 ? -1 : 1;
}


function tappedRollDirection(input: Readonly<Controls>): number {
  return input.getupDirectionPressed && stickX(input) === 0 && stickZ(input) === 0 ? input.getupDirection : 0;
}


function downRollDirection(input: Readonly<Controls>): number {
  if (input.cStickSideFlick !== 0) return input.cStickSideFlick;
  const heldRoll = stickRollDirection(input);
  return heldRoll !== 0 ? heldRoll : tappedRollDirection(input);
}


function standRequested(input: Readonly<Controls>): boolean {
  const z = stickZ(input);
  return input.getupStandPressed || (z >= GETUP_STAND_STICK_Z && meleeAtan2(z, Math.abs(stickX(input))) >= GETUP_STICK_ANGLE);
}

function startDownStand(f: Fighter): void {
  beginDownState(f, DownState.stand, 0);
}


export function resolveDownGroundContact(f: Fighter, stage: number, matchFrame: number): void {
  const { motion, down } = f;
  let deck = motion.surface;
  if (deck === undefined || deck >= surfaceCount(stage)) {
    for (let i = 0; i < surfaceCount(stage); i++) {
      if (motion.z === surfaceZAt(stage, i, matchFrame, motion.x) && motion.x >= surfaceLeft(stage, i, matchFrame) && motion.x <= surfaceRight(stage, i, matchFrame)) deck = i;
    }
  }
  if (deck !== undefined && deck < surfaceCount(stage)) {
    if (down.state === DownState.roll || down.state === DownState.techRoll || down.state === DownState.attack) {
      motion.x = max(surfaceLeft(stage, deck, matchFrame), min(surfaceRight(stage, deck, matchFrame), motion.x));
    }
    if (motion.x >= surfaceLeft(stage, deck, matchFrame) && motion.x <= surfaceRight(stage, deck, matchFrame)) {
      motion.surface = deck;
      motion.z = surfaceZAt(stage, deck, matchFrame, motion.x);
      return;
    }
  }
  if (down.state === DownState.attack) cancelAttack(f);
  clearDownState(f);
  motion.grounded = false;
  motion.surface = undefined;
  f.jump.remaining = min(f.jump.remaining, aerialJumps(f));
  const { airSpeed } = f.tuning.physics;
  motion.vx = max(-airSpeed, min(airSpeed, motion.vx));
  f.launch.groundKnockbackX = 0.0;
  clearDash(f);
}

function standOnDeck(f: Fighter, stage: number, matchFrame: number): void {
  f.motion.grounded = true;
  f.motion.z = surfaceZAt(stage, f.motion.surface ?? 0, matchFrame, f.motion.x);
}


export function advanceDownState(f: Fighter, stage: number, matchFrame: number, input: Readonly<Controls>): boolean {
  const { down, motion, launch } = f;
  const leavingBound = down.state === DownState.bound && down.frame >= DOWN_BOUND_FRAMES;
  const leavingDamage = down.state === DownState.damage && down.frame >= DOWN_DAMAGE_FRAMES;
  if (down.state === DownState.none) return false;
  if (down.state === DownState.tumble) {
    down.frame++;
    return false;
  }
  if (isFloorTeching(f) || down.state === DownState.bound) {
    decayKnockback(f);
    motion.x = f32(motion.x + launch.knockbackX);
  }
  if (isFloorTeching(f)) {
    down.frame++;
    applyDownRollTravel(f, stage, matchFrame);
    return true;
  }

  if (down.state === DownState.bound) {
    if (down.frame < DOWN_BOUND_FRAMES) {
      if (input.getupAttackPressed) down.attackQueued = true;
      down.frame++;
      standOnDeck(f, stage, matchFrame);
      return true;
    }

    const attackQueued = down.attackQueued || input.cStickUpFlick;
    const roll = downRollDirection(input);
    startDownWait(f, DOWN_WAIT_FRAMES);
    if (attackQueued || roll !== 0) {
      standOnDeck(f, stage, matchFrame);
      beginDownState(f, attackQueued ? DownState.attack : DownState.roll, attackQueued ? 0 : roll);
      applyDownRollTravel(f, stage, matchFrame);
      return true;
    }
  }
  if (down.state === DownState.damage) {
    standOnDeck(f, stage, matchFrame);
    motion.vz = 0.0;
    launch.knockbackZ = 0.0;
    if (down.frame >= DOWN_DAMAGE_FRAMES) {
      if (launch.hitstun <= 0) {
        startDownStand(f);
        return true;
      }
      startDownWait(f, launch.hitstun);
    } else {
      down.frame++;
      return true;
    }
  }
  if (down.state === DownState.wait) {
    standOnDeck(f, stage, matchFrame);
    if (!leavingBound && !leavingDamage) {
      down.waitRemaining = max(0, down.waitRemaining - 1);
      down.frame++;
      if (down.waitRemaining === 0) {
        startDownStand(f);
        return true;
      }
    }
    const roll = downRollDirection(input);
    if (input.getupAttackPressed || input.cStickUpFlick) beginDownState(f, DownState.attack, 0);
    else if (roll !== 0) beginDownState(f, DownState.roll, roll);
    else if (standRequested(input)) startDownStand(f);
    applyDownRollTravel(f, stage, matchFrame);
    return true;
  }
  if (down.state === DownState.stand || down.state === DownState.attack) {
    standOnDeck(f, stage, matchFrame);
    down.frame++;
    return true;
  }
  if (down.state === DownState.roll) {
    standOnDeck(f, stage, matchFrame);
    down.frame++;
    applyDownRollTravel(f, stage, matchFrame);
    standOnDeck(f, stage, matchFrame);
    return true;
  }
  return false;
}
