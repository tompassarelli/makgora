import { canHit } from "./teams";



import { max, min } from "../core/numbers";
import { f32 } from "wisp/src/sim/f32";
import { AttackStyle, Character, ProjectileKind, SPECIAL_ACTION_CAPACITY, SpecialAction, SurfaceContact } from "./codes";
import { canAttack, isIntangible } from "./conditions";
import { finishDamageContacts, openDamageContacts } from "./contacts";
import { type Fighter, TURNAROUND_SPECIAL_WINDOW_FRAMES } from "./fighter";
import {
  RIFLEMAN_BLASTER_AIR_FRAMES, RIFLEMAN_BLASTER_AIR_SHOT_FRAME, RIFLEMAN_BLASTER_GROUND_FRAMES,
  RIFLEMAN_BLASTER_GROUND_SHOT_FRAME,
} from "./moves";
import { HitElement, type HitEffect, type HitRegion, NO_HIT_REGION } from "./hitRegions";
import { heroSpecialMove } from "./specials/schema";
import { advanceHeroCommandGrab } from "./heroCommandGrab";
import { enterExSpecial } from "./exSpecials";
import { ROSTER_MANA, spendMana } from "./mana";
import { cancelAttack } from "./transitions";
import { applyAttackHit } from "./hits";
import { meleeHitIntersectsShield } from "./attacks";
import { observeActionDecision } from "./observations";
import { PARTICIPANT_CAPACITY } from "../input/participants";
import { spawnBlasterShot, spawnProjectileMotion } from "./projectiles";
import { type Controls, type Roster, copyControls, fighterAt, isActive, neutralControls } from "./roster";
import { floorBelow, surfaceZAt } from "./stage";
import { belowStandingPlatform } from "./platformMoves";
import { advanceCompanion } from "./companions";
import { RIFLEMAN_BEAR_LIFETIME, advanceBear, recordSpecialHit, specialAlreadyHit, canStartFreezeTrap, startFreezeTrap } from "./summons";
import { at } from "wisp/src/runtime/lookup";
import { travelBeforeBodies } from "./travelStop";
import { advanceHeroSpecial, followUpOnContact, chargedAimX, enterUltimate, chargedAimZ, holdHoveringUltimate, chooseHeroSpecial, enterHeroSpecial, followUpHeroSpecial, heroRegionOrigin, heroSpecialContact, heroStrikeMeetsShield, isHeroSpecialAction, relocateHeroSpecial, runningHeroSpecial, resolveHeroGuards, steerHeroSpecial, stopHeroMotionAtBodies } from "./specials/engine";
import { mutableBear } from "./fighterRest";


export const DEMONHUNTER_MANA_BURN_STARTUP = 16;
export const DEMONHUNTER_MANA_BURN_RECOVERY = 30;
export const DEMONHUNTER_MANA_BURN_SPEED = 12.0;
export const DEMONHUNTER_MANA_BURN_LIFETIME = 90;

export const DEMONHUNTER_MANA_BURN_HEIGHT = 45.0;





export const FEL_RUSH_TELL_LAST = 5;
export const FEL_RUSH_FIRST = 6;
export const FEL_RUSH_LAST = 15;
export const FEL_RUSH_FRAMES = 29;
export const FEL_RUSH_SPEED = 20.0;
export const FEL_RUSH_BRANCH_FIRST = 10;
export const FEL_RUSH_BRANCH_LAST = 24;
export const FEL_RUSH_COOLDOWN = 40;
export const EYE_BLAST_FORM = 1;
export const EYE_BLAST_WINDUP = 24;
export const EYE_BLAST_FIRST = EYE_BLAST_WINDUP + 1;
export const EYE_BLAST_LAST = EYE_BLAST_FIRST + 9;
export const EYE_BLAST_FRAMES = 60;
export const EYE_BLAST_NEAR = 195.0;
export const EYE_BLAST_SWEEP = 50.0;
export const EYE_BLAST_REACH = EYE_BLAST_NEAR + EYE_BLAST_SWEEP * (EYE_BLAST_LAST - EYE_BLAST_FIRST);

const FEL_RUSH_AIRTIME = 2;
const FEL_RUSH_AIR_CARRY = 5.0;
export const VENGEFUL_RETREAT_FORM = 1;
export const CHAOS_STRIKE_FORM = 2;
export const CHAOS_STRIKE_AIR_FORM = 3;

export const VENGEFUL_RETREAT_FRAMES = 16;
export const VENGEFUL_RETREAT_MOVE_LAST = 10;
export const VENGEFUL_RETREAT_SPEED = 16.0;
const VENGEFUL_RETREAT_RISE = 16.0;
const VENGEFUL_RETREAT_FALL = 1.2000000476837158;
export const CHAOS_STRIKE_FIRST = 5;
export const CHAOS_STRIKE_LAST = 8;
export const CHAOS_STRIKE_FRAMES = 30;
const CHAOS_STRIKE_LANDING_LAG = 12;
export const DEMONHUNTER_WING_STARTUP = 3;
export const DEMONHUNTER_WING_DURATION = 28;


export const DEMONHUNTER_DIVE_FIRST = 15;
export const DEMONHUNTER_DIVE_LAST = 27;
export const DEMONHUNTER_BACKFLIP_FORM = 1;
export const DEMONHUNTER_DIVE_FORM = 2;
export const DEMONHUNTER_BACKFLIP_FRAMES = 6;
export const DEMONHUNTER_DIVE_FRAMES = 13;
export const DEMONHUNTER_DIVE_SPEED = 30.0;
const DEMONHUNTER_BACKFLIP_DRIFT = 4.0;
const DEMONHUNTER_BACKFLIP_RISE = 10.0;
const DEMONHUNTER_BACKFLIP_FALL = 2.0;
const DEMONHUNTER_DIVE_CARRY = 5.0;
export const DEMONHUNTER_DIVE_LANDING_LAG = 10;
export const DEMONHUNTER_IMMOLATE_STARTUP = 1;
export const DEMONHUNTER_IMMOLATE_ACTIVE = 1;
export const DEMONHUNTER_IMMOLATE_JUMP_CANCEL = 4;
export const DEMONHUNTER_IMMOLATE_DURATION = 27;








export const RIFLEMAN_RECOVERY_STARTUP_FRAMES = 4;
export const RIFLEMAN_RECOVERY_PROTECTION_END = 7;
const RIFLEMAN_RECOIL_SPEED = 33.0;
const RIFLEMAN_RECOIL_SHOT_SPEED = 28.0;
export const RIFLEMAN_SECOND_SHOT_FIRST = 12;
export const RIFLEMAN_SECOND_SHOT_LAST = 24;
const RIFLEMAN_SECOND_SHOT_SPEED = 18.0;
export const RIFLEMAN_SECOND_SHOT_FORM = 1;

const AIM_DIAGONAL = 0.7071067690849304;
const RIFLEMAN_RECOVERY_FRAMES = 34;

export const RIFLEMAN_BEAR_CAST_FRAMES = 27;

export const RIFLEMAN_BEAR_SUMMON_FRAMES = RIFLEMAN_BEAR_CAST_FRAMES + 18;
const TRAP_APPEAR_FRAME = 22;
const TRAP_SET_FRAMES = 38;

const SPECIAL_ACTION_BIT = 64;

function startSpecialAction(owner: Fighter, action: SpecialAction, duration: number, direction: number): void {
  const { special, attack } = owner;
  if (action === SpecialAction.demonHunterImmolate || isHeroSpecialAction(action)) {
    for (let entry = 0; entry < PARTICIPANT_CAPACITY; entry++) special.hitTargets[entry] = undefined;
  }
  owner.surfaceRecovery.state = SurfaceContact.none;
  owner.surfaceRecovery.frame = 0;
  owner.motion.fastFalling = false;
  owner.motion.crouching = false;
  special.action = action;
  special.ex = false;
  special.exArmorUsed = false;
  special.variant = 0;
  special.frame = 0;

  special.form = 0;
  special.duration = duration;
  special.lockFrames = duration;
  special.direction = direction < 0 ? -1 : direction > 0 ? 1 : 0;
  attack.style = undefined;
  attack.frame = 0;
  attack.duration = 0;
  attack.hit = false;
  attack.smashCharging = false;
  attack.smashChargeFrames = 0;
  attack.smashChargeAllowed = false;
  owner.shield.raised = false;
  owner.shield.heldFrames = 0;
  attack.cooldown = max(attack.cooldown, duration);
}


function specialDirection(input: Readonly<Controls>, facing: number): number {
  if (input.specialX !== 0) return input.specialX;
  return input.specialZ === 0 ? facing : 0;
}

function requestedSpecial(owner: Fighter, input: Readonly<Controls>): SpecialAction {
  const up = input.specialZ > 0;
  const down = input.specialZ < 0;
  const side = input.specialX !== 0;
  switch (owner.character) {
    default:
      return up ? SpecialAction.heroUp : down ? SpecialAction.heroDown : side ? SpecialAction.heroSide : SpecialAction.heroNeutral;
    case Character.rifleman:
      return down ? SpecialAction.riflemanTrap : up ? SpecialAction.riflemanRecovery : side ? SpecialAction.riflemanBear : SpecialAction.riflemanBlaster;
    case Character.demonHunter:
      return up ? SpecialAction.demonHunterWingAscent : down ? SpecialAction.demonHunterImmolate
        : side ? SpecialAction.demonHunterFelRush : SpecialAction.demonHunterManaBurn;
  }
}

function specialCanStart(owner: Fighter, action: SpecialAction): boolean {
  const { special } = owner;
  return action > SpecialAction.none && action < SPECIAL_ACTION_CAPACITY && at(special.cooldowns, action) <= 0
    && special.lockFrames <= 0 && special.action === SpecialAction.none && canAttack(owner);
}

function launchUpward(owner: Fighter): void {
  owner.motion.grounded = false;
  owner.motion.surface = undefined;
  owner.jump.remaining = 0;
}

function startRiflemanSpecial(owner: Fighter, stage: number, matchFrame: number, action: SpecialAction, moveX: number): boolean {
  const { motion, bear, special } = owner;
  if (action === SpecialAction.riflemanTrap) {
    if (!canStartFreezeTrap(owner)) return false;
    startSpecialAction(owner, action, TRAP_SET_FRAMES, moveX);
    special.cooldowns[action] = 90;
    return true;
  }
  if (action === SpecialAction.riflemanRecovery) {
    if (!motion.grounded) owner.jump.remaining = 0;
    startSpecialAction(owner, action, RIFLEMAN_RECOVERY_FRAMES, moveX);
    special.form = 0;
    special.cooldowns[action] = 90;
    return true;
  }
  if (action === SpecialAction.riflemanBear) {
    if (bear.life > 0) return false;
    startSpecialAction(owner, action, RIFLEMAN_BEAR_SUMMON_FRAMES, moveX);
    owner.facing = moveX;
    special.cooldowns[action] = 90;
    return true;
  }
  startSpecialAction(owner, action, motion.grounded ? RIFLEMAN_BLASTER_GROUND_FRAMES : RIFLEMAN_BLASTER_AIR_FRAMES, moveX);
  special.cooldowns[action] = 8;
  return true;
}





function fireRecoil(owner: Fighter, aimX: number, aimZ: number, speed: number, serial: number): void {
  const x = aimX < 0 ? -1 : aimX > 0 ? 1 : 0;
  const z = aimZ < 0 ? -1 : aimZ > 0 || x === 0 ? 1 : 0;
  const scale = x !== 0 && z !== 0 ? AIM_DIAGONAL : 1.0;
  spawnProjectileMotion(owner, ProjectileKind.recoil, f32(f32(-x * RIFLEMAN_RECOIL_SHOT_SPEED) * scale), f32(f32(-z * RIFLEMAN_RECOIL_SHOT_SPEED) * scale), 8, serial);
  const travelSpeed = f32(speed * (owner.special.ex ? 1.25 : 1.0));
  owner.motion.vx = f32(f32(x * travelSpeed) * scale);
  owner.motion.vz = f32(f32(z * travelSpeed) * scale);
}





function secondRecoilShot(owner: Fighter, input: Readonly<Controls>): boolean {
  const { special } = owner;
  const next = special.frame + 1;
  if (special.form === RIFLEMAN_SECOND_SHOT_FORM || next < RIFLEMAN_SECOND_SHOT_FIRST || next > RIFLEMAN_SECOND_SHOT_LAST || owner.launch.hitlag > 0) return false;
  const pressed = input.specialX !== 0 || input.specialZ !== 0;
  fireRecoil(owner, pressed ? input.specialX : chargedAimX(input), pressed ? input.specialZ : chargedAimZ(input), RIFLEMAN_SECOND_SHOT_SPEED, owner.attack.serial + 1);
  special.form = RIFLEMAN_SECOND_SHOT_FORM;
  return true;
}







export function demonHunterJumpOrAttackBranch(owner: Fighter, input: Readonly<Controls>): void {
  const { special } = owner;
  if (owner.character !== Character.demonHunter || owner.launch.hitlag > 0) return;
  if (input.jumpPressed && special.action === SpecialAction.demonHunterImmolate && special.form === 0 && special.frame >= DEMONHUNTER_IMMOLATE_JUMP_CANCEL) {
    special.action = SpecialAction.none;
    special.frame = 0;
    special.lockFrames = 0;
    owner.attack.cooldown = 0;
    return;
  }
  if (input.attackPressed && special.action === SpecialAction.demonHunterFelRush) {
    felRushBranch(owner, input, true);
  }
}

function wingDive(owner: Fighter, input: Readonly<Controls>): boolean {
  const { special } = owner;
  if (special.form !== 0 || special.frame < DEMONHUNTER_DIVE_FIRST || special.frame > DEMONHUNTER_DIVE_LAST || owner.launch.hitlag > 0) return false;
  aimDive(owner, input);
  observeActionDecision(SPECIAL_ACTION_BIT);
  startBranchPhase(owner, DEMONHUNTER_BACKFLIP_FORM, DEMONHUNTER_BACKFLIP_FRAMES);
  return true;
}

function aimDive(owner: Fighter, input: Readonly<Controls>): void {
  const { special } = owner;
  const pressed = input.specialX !== 0 || input.specialZ !== 0;
  const aimX = sign(pressed ? input.specialX : chargedAimX(input));
  const aimZ = sign(pressed ? input.specialZ : chargedAimZ(input));
  const neutral = aimX === 0 && aimZ === 0;
  special.aimX = neutral ? owner.facing : aimX;
  special.aimZ = neutral ? -1 : aimZ;
  if (special.aimX !== 0) owner.facing = special.aimX;
}

const sign = (value: number): number => value < 0 ? -1 : value > 0 ? 1 : 0;

function startBranchPhase(owner: Fighter, form: number, frames: number): void {
  const { special } = owner;
  special.form = form;
  special.frame = 0;
  special.duration = frames;
  special.lockFrames = frames;
  owner.attack.cooldown = max(owner.attack.cooldown, frames);
}


export function demonHunterAuthoredMotion(f: Readonly<Fighter>): boolean {
  const { special } = f;
  if (special.action === SpecialAction.demonHunterImmolate) return !f.motion.grounded;
  if (special.action === SpecialAction.demonHunterFelRush) {
    return special.form === 0 ? special.frame < FEL_RUSH_LAST : special.form === VENGEFUL_RETREAT_FORM && special.frame < VENGEFUL_RETREAT_MOVE_LAST;
  }
  return special.action === SpecialAction.demonHunterWingAscent && special.form !== 0;
}





function stallImmolate(owner: Fighter): void {
  if (owner.motion.grounded) return;
  owner.motion.vx = 0.0;
  owner.motion.vz = 0.0;
}






function felRushBranch(owner: Fighter, input: Readonly<Controls>, attack: boolean): boolean {
  const { special, motion } = owner;
  const next = special.frame + 1;
  if (special.form !== 0 || next < FEL_RUSH_BRANCH_FIRST || next > FEL_RUSH_BRANCH_LAST || owner.launch.hitlag > 0 || owner.launch.hitstun > 0) return false;
  special.exArmorUsed = special.ex;
  for (let entry = 0; entry < PARTICIPANT_CAPACITY; entry++) special.hitTargets[entry] = undefined;
  special.hit = false;

  owner.attack.cooldown = 0;
  if (attack) {
    if (input.direction !== 0) owner.facing = input.direction < 0 ? -1 : 1;
    startBranchPhase(owner, motion.grounded ? CHAOS_STRIKE_FORM : CHAOS_STRIKE_AIR_FORM, CHAOS_STRIKE_FRAMES);
    motion.vx = motion.grounded ? 0.0 : f32(owner.facing * FEL_RUSH_AIR_CARRY);
    return true;
  }
  startBranchPhase(owner, VENGEFUL_RETREAT_FORM, VENGEFUL_RETREAT_FRAMES);
  motion.grounded = false;
  motion.surface = undefined;
  motion.vx = f32(-owner.facing * VENGEFUL_RETREAT_SPEED);
  motion.vz = VENGEFUL_RETREAT_RISE;
  observeActionDecision(SPECIAL_ACTION_BIT);
  return true;
}






function advanceFelRush(owner: Fighter): void {
  const { special, motion } = owner;
  const frame = special.frame;
  if (special.form === 0) {
    const rushing = frame >= FEL_RUSH_FIRST - 1 && frame < FEL_RUSH_LAST;
    if (frame < FEL_RUSH_LAST) {
      motion.vx = rushing ? f32(owner.facing * FEL_RUSH_SPEED) : 0.0;
      if (!motion.grounded) motion.vz = 0.0;
    } else if (frame === FEL_RUSH_LAST) {
      motion.vx = motion.grounded ? 0.0 : f32(owner.facing * FEL_RUSH_AIR_CARRY);
    }
    return;
  }
  if (special.form === VENGEFUL_RETREAT_FORM) {
    if (motion.grounded && frame > 1) {
      endSpecialAction(owner, false);
      return;
    }
    if (frame < VENGEFUL_RETREAT_MOVE_LAST) {
      motion.vx = f32(-owner.facing * VENGEFUL_RETREAT_SPEED);
      motion.vz = f32(VENGEFUL_RETREAT_RISE - f32(frame * VENGEFUL_RETREAT_FALL));
    } else if (frame === VENGEFUL_RETREAT_MOVE_LAST) {
      motion.vx = f32(-owner.facing * FEL_RUSH_AIR_CARRY);
    }
    return;
  }
  if (special.form === CHAOS_STRIKE_AIR_FORM && motion.grounded) {
    special.action = SpecialAction.none;
    special.frame = 0;
    special.lockFrames = 0;
    owner.attack.cooldown = 0;
    owner.landing.lag = max(owner.landing.lag, CHAOS_STRIKE_LANDING_LAG);
  }
}


function stopFelRushAtShields(world: Roster, slot: number): void {
  const f = fighterAt(world, slot);
  if (f.character !== Character.demonHunter || f.special.action !== SpecialAction.demonHunterFelRush || f.special.form !== 0) return;
  const forward = f32(f.motion.vx * f.facing);
  if (forward <= 0.0) return;
  f.motion.vx = f32(f.facing * travelBeforeBodies(world, slot, forward, false));
}


function advanceWingDive(owner: Fighter): void {
  const { motion, special } = owner;
  if (motion.grounded) {
    special.action = SpecialAction.none;
    special.frame = 0;
    special.lockFrames = 0;
    owner.attack.cooldown = 0;
    owner.landing.lag = max(owner.landing.lag, DEMONHUNTER_DIVE_LANDING_LAG);
    return;
  }
  if (special.form === DEMONHUNTER_BACKFLIP_FORM) {
    motion.vx = f32(-owner.facing * DEMONHUNTER_BACKFLIP_DRIFT);
    motion.vz = f32(DEMONHUNTER_BACKFLIP_RISE - f32(special.frame * DEMONHUNTER_BACKFLIP_FALL));
    if (special.frame < special.duration) return;
    startBranchPhase(owner, DEMONHUNTER_DIVE_FORM, DEMONHUNTER_DIVE_FRAMES);
    for (let entry = 0; entry < PARTICIPANT_CAPACITY; entry++) special.hitTargets[entry] = undefined;
    special.hit = false;
  }
  if (special.frame < special.duration) {
    const scale = special.aimX !== 0 && special.aimZ !== 0 ? AIM_DIAGONAL : 1.0;
    motion.vx = f32(f32(special.aimX * DEMONHUNTER_DIVE_SPEED) * scale);
    motion.vz = f32(f32(special.aimZ * DEMONHUNTER_DIVE_SPEED) * scale);
  } else {
    motion.vx = f32(special.aimX * DEMONHUNTER_DIVE_CARRY);
    motion.vz = 0.0;
  }
}


function summonBear(owner: Fighter, stage: number, matchFrame: number): void {
  const { motion, special } = owner;
  const bear = mutableBear(owner);
  const moveX = special.direction;
  bear.life = RIFLEMAN_BEAR_LIFETIME;
  bear.exDamage = special.ex;
  bear.x = f32(motion.x + f32(moveX * 45));
  bear.z = motion.grounded && motion.surface !== undefined ? surfaceZAt(stage, motion.surface, matchFrame, bear.x) : motion.z;
  bear.velocityX = f32(moveX * 14.0);
  bear.velocityZ = motion.grounded ? 0.0 : motion.vz;
  bear.surface = motion.grounded ? motion.surface : undefined;
  bear.swipeCooldown = 5;
}


function manaBurnInFlight(owner: Readonly<Fighter>): boolean {
  for (const projectile of owner.projectiles) if (projectile.life > 0 && projectile.kind === ProjectileKind.manaBurn) return true;
  return false;
}

function startDemonHunterSpecial(owner: Fighter, action: SpecialAction, moveX: number): boolean {
  const { motion, special } = owner;
  if (action === SpecialAction.demonHunterWingAscent) {
    startSpecialAction(owner, action, DEMONHUNTER_WING_DURATION, moveX);
    special.cooldowns[action] = 90;
    motion.vx = f32(moveX * 5.0);
    motion.vz = 30.0;
    launchUpward(owner);
    owner.jump.squat = 0;
    return true;
  }
  if (action === SpecialAction.demonHunterImmolate) {
    startSpecialAction(owner, action, DEMONHUNTER_IMMOLATE_DURATION, moveX);
    special.cooldowns[action] = 24;
    special.hit = false;
    owner.status.invincible = max(owner.status.invincible, 2);
    stallImmolate(owner);
    return true;
  }
  if (action === SpecialAction.demonHunterFelRush) {
    if (!motion.grounded && (special.airtimeUses & FEL_RUSH_AIRTIME) !== 0) return false;

    owner.facing = moveX < 0 ? -1 : 1;
    startSpecialAction(owner, action, FEL_RUSH_FRAMES, moveX);
    special.cooldowns[action] = FEL_RUSH_COOLDOWN;
    special.hit = false;
    if (!motion.grounded) special.airtimeUses |= FEL_RUSH_AIRTIME;
    motion.vx = 0.0;
    if (!motion.grounded) motion.vz = 0.0;
    return true;
  }
  if (manaBurnInFlight(owner)) return false;
  startSpecialAction(owner, action, DEMONHUNTER_MANA_BURN_STARTUP + DEMONHUNTER_MANA_BURN_RECOVERY, moveX);
  special.cooldowns[action] = 24;
  return true;
}


function enterEyeBlast(owner: Fighter): void {
  const { special } = owner;
  for (let entry = 0; entry < PARTICIPANT_CAPACITY; entry++) special.hitTargets[entry] = undefined;
  special.form = EYE_BLAST_FORM;
  special.hit = false;
  special.duration = EYE_BLAST_FRAMES;
  special.lockFrames = EYE_BLAST_FRAMES;
  special.cooldowns[SpecialAction.demonHunterManaBurn] = EYE_BLAST_FRAMES;
  owner.attack.cooldown = max(owner.attack.cooldown, EYE_BLAST_FRAMES);
  owner.motion.vx = 0.0;
}

const heroRefusal = { groundOnly: false };
const neutralPress = neutralControls();







function turnForSpecial(owner: Fighter, input: Readonly<Controls>): void {
  if (input.specialZ > 0 && input.specialX !== 0) owner.facing = input.specialX < 0 ? -1 : 1;
  if (input.specialZ !== 0) return;
  const { motion } = owner;
  if (input.specialX !== 0) owner.facing = input.specialX < 0 ? -1 : 1;
  else if (input.walking && input.direction !== 0) owner.facing = input.direction < 0 ? -1 : 1;
  else if (motion.turnaroundSide !== 0 && motion.turnaroundAge <= TURNAROUND_SPECIAL_WINDOW_FRAMES) owner.facing = motion.turnaroundSide;
}




function startHeroFighterSpecial(owner: Fighter, input: Readonly<Controls>, world: Roster | undefined): boolean {
  const specials = owner.tuning.specials;
  const { special } = owner;
  if (specials === undefined || special.lockFrames > 0 || special.action !== SpecialAction.none || !canAttack(owner)) return false;
  let chosen = chooseHeroSpecial(owner, specials, input, heroRefusal, world);

  if (chosen === undefined && heroRefusal.groundOnly && input.specialX !== 0 && input.specialZ === 0) {
    copyControls(neutralPress, input);
    neutralPress.specialX = 0;
    chosen = chooseHeroSpecial(owner, specials, neutralPress, heroRefusal, world);
  }
  if (chosen === undefined) return false;
  observeActionDecision(SPECIAL_ACTION_BIT);
  turnForSpecial(owner, input);
  const move = heroSpecialMove(specials, chosen);
  if (input.specialX !== 0 && input.specialZ !== 0 && move.facesStick === true) owner.facing = input.specialX < 0 ? -1 : 1;
  const action = SpecialAction.heroNeutral + chosen.slot;
  startSpecialAction(owner, heroAction(action), move.endFrame, specialDirection(input, owner.facing));
  enterExSpecial(owner, input);
  enterHeroSpecial(owner, chosen, input);
  return true;
}


/** Frames into a special or attack an ultimate may still replace, so Attack and Special need not land on one frame. */
export const ULTIMATE_INPUT_LENIENCY = 3;

function replaceableForUltimate(owner: Readonly<Fighter>): boolean {
  const { special, attack } = owner;
  if (special.action === SpecialAction.heroUltimate) return false;
  if (owner.launch.hitlag > 0 || owner.launch.hitstun > 0 || owner.status.frozenFrames > 0 || owner.shield.raised) return false;
  if (special.action !== SpecialAction.none) return special.frame <= ULTIMATE_INPUT_LENIENCY;
  return attack.style === undefined || (attack.frame <= ULTIMATE_INPUT_LENIENCY && !attack.hit);
}

/** Starts the ultimate at a full bar; anything else leaves the press to the ordinary special. */
export function startUltimate(owner: Fighter, input: Readonly<Controls>, stage: number, matchFrame: number): boolean {
  const ultimate = owner.tuning.ultimate;
  if (!input.ultimatePressed || ultimate === undefined || owner.mana.points < ROSTER_MANA.max) return false;
  if (!owner.motion.grounded && (ultimate.groundOnly === true || (ultimate.needsFloorBelow === true && floorBelow(stage, matchFrame, owner.motion.x, owner.motion.z) === undefined))) return false;
  if (!replaceableForUltimate(owner)) return false;
  const { special } = owner;
  if (special.action !== SpecialAction.none) {
    if (special.ex) owner.mana.points = min(ROSTER_MANA.max, owner.mana.points + ROSTER_MANA.exCost);
    special.action = SpecialAction.none;
    special.lockFrames = 0;
    owner.attack.cooldown = 0;
  } else if (owner.attack.style !== undefined) {
    cancelAttack(owner);
    owner.attack.cooldown = 0;
  }
  if (special.lockFrames > 0 || !canAttack(owner) || owner.mana.points < ROSTER_MANA.max) return false;
  observeActionDecision(SPECIAL_ACTION_BIT);
  turnForSpecial(owner, input);
  startSpecialAction(owner, SpecialAction.heroUltimate, ultimate.endFrame, owner.facing);
  spendMana(owner, ROSTER_MANA.max);
  enterUltimate(owner, input);
  holdHoveringUltimate(owner);
  return true;
}


export function startFighterSpecial(owner: Fighter, stage: number, matchFrame: number, input: Readonly<Controls>, world?: Roster): boolean {
  steerHeroSpecial(owner, input);
  if (startUltimate(owner, input, stage, matchFrame)) return true;
  if (owner.special.action === SpecialAction.heroUltimate) return false;
  if (owner.tuning.specials !== undefined && isHeroSpecialAction(owner.special.action)) return followUpHeroSpecial(owner, input);
  if (!input.specialPressed) return false;
  if (owner.tuning.specials !== undefined) return startHeroFighterSpecial(owner, input, world);
  const branched = originalSpecialBranch(owner, input);
  if (branched !== undefined) return branched;
  const requested = requestedSpecial(owner, input);
  if (!specialCanStart(owner, requested)) return false;
  observeActionDecision(SPECIAL_ACTION_BIT);
  const facing = owner.facing;
  turnForSpecial(owner, input);
  const moveX = specialDirection(input, owner.facing);
  const started = startOriginalSpecial(owner, stage, matchFrame, requested, moveX);
  if (started) {
    enterExSpecial(owner, input);
    if (requested === SpecialAction.demonHunterManaBurn && owner.special.ex && owner.motion.grounded) enterEyeBlast(owner);
  }
  else owner.facing = facing;
  return started;
}

function originalSpecialBranch(owner: Fighter, input: Readonly<Controls>): boolean | undefined {
  const { action } = owner.special;
  if (owner.character === Character.rifleman && action === SpecialAction.riflemanRecovery) return secondRecoilShot(owner, input);
  if (owner.character !== Character.demonHunter) return undefined;
  if (action === SpecialAction.demonHunterFelRush) return felRushBranch(owner, input, false);
  if (action === SpecialAction.demonHunterWingAscent) return wingDive(owner, input);
  return undefined;
}

function startOriginalSpecial(owner: Fighter, stage: number, matchFrame: number, requested: SpecialAction, moveX: number): boolean {
  switch (owner.character) {
    case Character.rifleman:
      return startRiflemanSpecial(owner, stage, matchFrame, requested, moveX);
    case Character.demonHunter:
      return startDemonHunterSpecial(owner, requested, moveX);
    default:
      return false;
  }
}


function endSpecialAction(owner: Fighter, helpless: boolean): void {
  if (helpless && !owner.motion.grounded) {
    owner.special.fall = true;
    owner.jump.remaining = 0;
  }
  owner.special.action = SpecialAction.none;
  owner.special.frame = 0;
}

function advanceSpecialAction(owner: Fighter, stage: number, matchFrame: number, input: Readonly<Controls> | undefined, world: Roster): void {
  const { special, motion } = owner;
  if (special.action === SpecialAction.none || owner.launch.hitlag > 0) return;
  if (isHeroSpecialAction(special.action)) followUpOnContact(owner);
  special.frame++;
  if (isHeroSpecialAction(special.action)) {
    advanceHeroSpecial(owner, stage, input, world, matchFrame);
    return;
  }
  const shotSerial = owner.attack.serial + 1;
  if (special.action === SpecialAction.riflemanBlaster) {
    const grounded = special.duration === RIFLEMAN_BLASTER_GROUND_FRAMES;
    if (special.frame === (grounded ? RIFLEMAN_BLASTER_GROUND_SHOT_FRAME : RIFLEMAN_BLASTER_AIR_SHOT_FRAME)) spawnBlasterShot(owner, shotSerial, grounded);
  }
  if (special.action === SpecialAction.riflemanTrap && special.frame === TRAP_APPEAR_FRAME) startFreezeTrap(owner, stage, matchFrame);
  if (special.action === SpecialAction.riflemanBear && special.frame === RIFLEMAN_BEAR_CAST_FRAMES) summonBear(owner, stage, matchFrame);
  if (special.action === SpecialAction.demonHunterManaBurn && special.form === EYE_BLAST_FORM && motion.grounded) motion.vx = 0.0;
  if (special.action === SpecialAction.demonHunterManaBurn && special.form !== EYE_BLAST_FORM && special.frame === DEMONHUNTER_MANA_BURN_STARTUP) {
    spawnProjectileMotion(owner, ProjectileKind.manaBurn, f32(owner.facing * DEMONHUNTER_MANA_BURN_SPEED), 0.0, DEMONHUNTER_MANA_BURN_LIFETIME, shotSerial, 1.0, DEMONHUNTER_MANA_BURN_HEIGHT);
  }
  if (special.action === SpecialAction.riflemanRecovery) {
    if (special.frame === RIFLEMAN_RECOVERY_STARTUP_FRAMES) {
      const aimX = input === undefined ? 0 : chargedAimX(input);
      const aimZ = input === undefined ? 0 : chargedAimZ(input);
      if (aimX === 0 && aimZ >= 0) {

        spawnProjectileMotion(owner, ProjectileKind.recoil, f32(owner.facing * 2.0), -RIFLEMAN_RECOIL_SHOT_SPEED, 8, shotSerial);
        motion.vx = f32(f32(special.direction * 8.0) * (special.ex ? 1.25 : 1.0));
        motion.vz = f32(RIFLEMAN_RECOIL_SPEED * (special.ex ? 1.25 : 1.0));
      } else {
        fireRecoil(owner, aimX, aimZ, RIFLEMAN_RECOIL_SPEED, shotSerial);
      }
      launchUpward(owner);
    }
    if (special.frame >= RIFLEMAN_RECOVERY_STARTUP_FRAMES && special.frame <= RIFLEMAN_RECOVERY_PROTECTION_END) {
      owner.status.invincible = max(owner.status.invincible, 2);
    }
  }
  if (special.action === SpecialAction.demonHunterWingAscent && special.form !== 0) advanceWingDive(owner);
  if (special.action === SpecialAction.demonHunterFelRush) advanceFelRush(owner);
  if (special.action === SpecialAction.demonHunterImmolate) stallImmolate(owner);
  if (special.action === SpecialAction.demonHunterWingAscent && special.form === 0 && special.frame === DEMONHUNTER_WING_STARTUP) {
    motion.vz = special.ex ? 37.5 : 30.0;
    motion.vx = f32(f32(special.direction * 5.0) * (special.ex ? 1.25 : 1.0));
    launchUpward(owner);
    owner.status.invincible = max(owner.status.invincible, 4);
  }
  if (special.action === SpecialAction.riflemanBear && special.frame >= RIFLEMAN_BEAR_SUMMON_FRAMES) endSpecialAction(owner, false);
  if (special.action === SpecialAction.riflemanRecovery && special.frame >= RIFLEMAN_RECOVERY_FRAMES) endSpecialAction(owner, true);
  if (special.action === SpecialAction.riflemanTrap && special.frame >= TRAP_SET_FRAMES) endSpecialAction(owner, false);
  if (special.action === SpecialAction.riflemanBlaster && special.frame >= special.duration) endSpecialAction(owner, false);
  if (special.action === SpecialAction.demonHunterManaBurn && special.frame >= special.duration) endSpecialAction(owner, false);
  if (special.action === SpecialAction.demonHunterFelRush && special.frame >= special.duration) {
    endSpecialAction(owner, false);
    special.lockFrames = 0;
  }
  if (special.action === SpecialAction.demonHunterWingAscent && special.frame >= special.duration) endSpecialAction(owner, true);
  if (special.action === SpecialAction.demonHunterImmolate && special.frame >= special.duration) endSpecialAction(owner, false);
}

const IMMOLATE_REACH = 116.0;
const IMMOLATE_REACH_EX = 140.0;

function immolateRegion(damage: number, reach: number, minZ: number, maxZ: number, facing: number): Readonly<HitRegion> {
  return {
    minX: facing > 0 ? 0.0 : -reach, maxX: facing > 0 ? reach : 0.0, minZ, maxZ,
    effect: { damage, growth: 49.62688064575195, base: 75.0, launchX: f32(facing * 0.08715574443340302), launchZ: 0.9961947202682495, electric: false, element: HitElement.fire, manaDrain: 6 },
    window: 1,
  };
}

const immolateSides = (damage: number, reach: number, minZ: number, maxZ: number): readonly Readonly<HitRegion>[] =>
  [immolateRegion(damage, reach, minZ, maxZ, 1.0), immolateRegion(damage, reach, minZ, maxZ, -1.0)];
const IMMOLATE_GROUND = immolateSides(7.0, IMMOLATE_REACH, -104.0, 108.0);
const IMMOLATE_AIR = immolateSides(9.0, IMMOLATE_REACH, -104.0, 108.0);
const IMMOLATE_GROUND_EX = immolateSides(7.0, IMMOLATE_REACH_EX, -114.0, 118.0);
const IMMOLATE_AIR_EX = immolateSides(9.0, IMMOLATE_REACH_EX, -114.0, 118.0);

function exDamageRegion(region: Readonly<HitRegion>): Readonly<HitRegion> {
  return {
    ...region,
    effect: { ...region.effect, damage: f32(region.effect.damage * 1.25) },
    groundedEffect: region.groundedEffect === undefined ? undefined : { ...region.groundedEffect, damage: f32(region.groundedEffect.damage * 1.25) },
  };
}


export const immolationRegion = (grounded: boolean, ex = false, behind = false): Readonly<HitRegion> =>
  at(grounded ? ex ? IMMOLATE_GROUND_EX : IMMOLATE_GROUND : ex ? IMMOLATE_AIR_EX : IMMOLATE_AIR, behind ? 1 : 0);



const WING_DIVE: Readonly<HitRegion> = {
  minX: -50.0, maxX: 70.0, minZ: -40.0, maxZ: 110.0,
  effect: { damage: 9.0, growth: 95.0, base: 26.0, launchX: 0.6427876353263855, launchZ: 0.7660444378852844, electric: false, element: HitElement.fire, manaDrain: 5 },
  window: 1,
};


export function wingDiveRegion(form: number, frame: number): Readonly<HitRegion> {
  return form === DEMONHUNTER_DIVE_FORM && frame < DEMONHUNTER_DIVE_FRAMES ? WING_DIVE : NO_HIT_REGION;
}


function wingDiveContact(owner: Fighter, targetSlot: number, target: Fighter): Readonly<HitRegion> {
  const region = wingDiveRegion(owner.special.form, owner.special.frame);
  if (region.window <= 0 || specialAlreadyHit(owner, targetSlot) || target.status.out || isIntangible(target)) return NO_HIT_REGION;
  const localX = f32(f32(target.motion.x - owner.motion.x) * owner.facing);
  const localZ = f32(target.motion.z - owner.motion.z);
  return localX >= region.minX && localX <= region.maxX && localZ >= region.minZ && localZ <= region.maxZ ? region : NO_HIT_REGION;
}


const FEL_RUSH_PASS: Readonly<HitRegion> = {
  minX: -40.0, maxX: 60.0, minZ: -20.0, maxZ: 140.0,
  effect: { damage: 6.0, growth: 40.0, base: 45.0, launchX: 0.1736481785774231, launchZ: 0.9848077297210693, electric: false, element: HitElement.fire, manaDrain: 4 },
  window: 1,
};
const CHAOS_STRIKE: Readonly<HitRegion> = {
  minX: 0.0, maxX: 150.0, minZ: -40.0, maxZ: 140.0,
  effect: { damage: 10.0, growth: 95.0, base: 30.0, launchX: 0.7660444378852844, launchZ: 0.6427876353263855, electric: false, element: HitElement.fire, manaDrain: 10 },
  window: 1,
};
const FEL_RUSH_PASS_EX = exDamageRegion(FEL_RUSH_PASS);
const CHAOS_STRIKE_EX = exDamageRegion(CHAOS_STRIKE);


export function felRushRegion(form: number, frame: number, ex = false): Readonly<HitRegion> {
  if (form === 0) return frame >= FEL_RUSH_FIRST && frame <= FEL_RUSH_LAST ? ex ? FEL_RUSH_PASS_EX : FEL_RUSH_PASS : NO_HIT_REGION;
  if (form === CHAOS_STRIKE_FORM || form === CHAOS_STRIKE_AIR_FORM) return frame >= CHAOS_STRIKE_FIRST && frame <= CHAOS_STRIKE_LAST ? ex ? CHAOS_STRIKE_EX : CHAOS_STRIKE : NO_HIT_REGION;
  return NO_HIT_REGION;
}

function felRushContact(owner: Fighter, targetSlot: number, target: Fighter): Readonly<HitRegion> {
  const region = felRushRegion(owner.special.form, owner.special.frame, owner.special.ex);
  if (region.window <= 0 || specialAlreadyHit(owner, targetSlot) || target.status.out || isIntangible(target)) return NO_HIT_REGION;
  const localX = f32(f32(target.motion.x - owner.motion.x) * owner.facing);
  const localZ = f32(target.motion.z - owner.motion.z);
  return localX >= region.minX && localX <= region.maxX && localZ >= region.minZ && localZ <= region.maxZ ? region : NO_HIT_REGION;
}

const EYE_BLAST_BEAM: readonly Readonly<HitRegion>[] = eyeBlastBeam();

function eyeBlastBeam(): Readonly<HitRegion>[] {
  const beam: Readonly<HitRegion>[] = [];
  for (let frame = EYE_BLAST_FIRST; frame <= EYE_BLAST_LAST; frame++) {
    beam.push({
      minX: 25.0, maxX: f32(EYE_BLAST_NEAR + f32(EYE_BLAST_SWEEP * (frame - EYE_BLAST_FIRST))), minZ: -60.0, maxZ: 45.0,
      effect: { damage: 12.0, growth: 75.0, base: 24.0, launchX: 0.8660253882408142, launchZ: 0.5, electric: false, element: HitElement.fire, manaDrain: 10 },
      window: 1,
    });
  }
  return beam;
}

export function eyeBlastRegion(frame: number): Readonly<HitRegion> {
  return frame >= EYE_BLAST_FIRST && frame <= EYE_BLAST_LAST ? at(EYE_BLAST_BEAM, frame - EYE_BLAST_FIRST) : NO_HIT_REGION;
}

function eyeBlastContact(owner: Fighter, targetSlot: number, target: Fighter): Readonly<HitRegion> {
  const region = eyeBlastRegion(owner.special.frame);
  if (region.window <= 0 || specialAlreadyHit(owner, targetSlot) || target.status.out || isIntangible(target)) return NO_HIT_REGION;
  const localX = f32(f32(target.motion.x - owner.motion.x) * owner.facing);
  const localZ = f32(target.motion.z - owner.motion.z);
  return localX >= region.minX && localX <= region.maxX && localZ >= region.minZ && localZ <= region.maxZ ? region : NO_HIT_REGION;
}

function demonHunterSpecialContact(owner: Fighter, targetSlot: number, target: Fighter): Readonly<HitRegion> {
  const { special } = owner;
  if (owner.character === Character.demonHunter && special.action === SpecialAction.demonHunterManaBurn && special.form === EYE_BLAST_FORM) return eyeBlastContact(owner, targetSlot, target);
  if (owner.character === Character.demonHunter && special.action === SpecialAction.demonHunterFelRush) return felRushContact(owner, targetSlot, target);
  if (owner.character === Character.demonHunter && special.action === SpecialAction.demonHunterWingAscent && special.form === DEMONHUNTER_DIVE_FORM) return wingDiveContact(owner, targetSlot, target);
  if (owner.character !== Character.demonHunter || special.action !== SpecialAction.demonHunterImmolate) return NO_HIT_REGION;
  if (specialAlreadyHit(owner, targetSlot) || special.frame < DEMONHUNTER_IMMOLATE_STARTUP) return NO_HIT_REGION;
  if (special.frame >= DEMONHUNTER_IMMOLATE_STARTUP + DEMONHUNTER_IMMOLATE_ACTIVE || target.status.out || isIntangible(target)) return NO_HIT_REGION;
  const localX = f32(f32(target.motion.x - owner.motion.x) * owner.facing);
  const localZ = f32(target.motion.z - owner.motion.z);
  const contact = immolationRegion(owner.motion.grounded, special.ex, localX < 0);
  const inside = localX >= contact.minX && localX <= contact.maxX && localZ >= contact.minZ && localZ <= contact.maxZ;
  return inside ? contact : NO_HIT_REGION;
}


const specialScratch = {
  contacts: Array.from({ length: PARTICIPANT_CAPACITY * PARTICIPANT_CAPACITY }, (): Readonly<HitRegion> => NO_HIT_REGION),
  facings: [0, 0, 0, 0],
  active: [false, false, false, false],
};


export function advanceSpecials(world: Roster, stage: number, matchFrame: number, inputs?: readonly Readonly<Controls>[]): void {
  const ownsBatch = openDamageContacts();
  const { contacts, facings, active } = specialScratch;
  resolveHeroGuards(world);
  for (let slot = 0; slot < PARTICIPANT_CAPACITY; slot++) {
    if (!isActive(world, slot)) continue;
    advanceSpecialAction(fighterAt(world, slot), stage, matchFrame, inputs?.[slot], world);
    relocateHeroSpecial(world, slot, stage, matchFrame);
    stopFelRushAtShields(world, slot);
    stopHeroMotionAtBodies(world, slot);
    advanceHeroCommandGrab(world, slot);
  }
  for (let ownerSlot = 0; ownerSlot < PARTICIPANT_CAPACITY; ownerSlot++) {
    if (!isActive(world, ownerSlot)) continue;
    const owner = fighterAt(world, ownerSlot);
    facings[ownerSlot] = owner.facing;

    active[ownerSlot] = owner.special.action !== SpecialAction.none;
    if (!active[ownerSlot]) continue;
    for (let targetSlot = 0; targetSlot < PARTICIPANT_CAPACITY; targetSlot++) {
      if (!isActive(world, targetSlot) || !canHit(world, ownerSlot, targetSlot)) continue;
      const target = fighterAt(world, targetSlot);
      contacts[ownerSlot * PARTICIPANT_CAPACITY + targetSlot] = belowStandingPlatform(owner, target, stage) ? NO_HIT_REGION
        : isHeroSpecialAction(owner.special.action) ? heroSpecialContact(owner, target, specialAlreadyHit(owner, targetSlot))
        : demonHunterSpecialContact(owner, targetSlot, target);
    }
  }
  for (let ownerSlot = 0; ownerSlot < PARTICIPANT_CAPACITY; ownerSlot++) {
    if (!isActive(world, ownerSlot) || !active[ownerSlot]) continue;
    const owner = fighterAt(world, ownerSlot);
    for (let targetSlot = 0; targetSlot < PARTICIPANT_CAPACITY; targetSlot++) {
      if (!isActive(world, targetSlot) || !canHit(world, ownerSlot, targetSlot)) continue;
      const contact = at(contacts, ownerSlot * PARTICIPANT_CAPACITY + targetSlot);
      if (contact.window <= 0) continue;
      const target = fighterAt(world, targetSlot);
      recordSpecialHit(owner, targetSlot);
      const strike = contact.strike;
      const contactZ = runningHeroSpecial(owner)?.beam !== undefined ? owner.special.beamZ
        : f32(heroRegionOrigin(owner).z + f32(f32((strike?.z1 ?? contact.minZ) + (strike?.z2 ?? contact.maxZ)) * 0.5));
      applyAttackHit(world, ownerSlot, targetSlot, AttackStyle.jab, at(facings, ownerSlot), heroContactEffect(contact, target), true,
        contact.strike === undefined ? meleeHitIntersectsShield(owner, target, contact) : heroStrikeMeetsShield(owner, target, contact), runningHeroSpecial(owner)?.strikeStatus, contactZ);
    }
  }
  for (let slot = 0; slot < PARTICIPANT_CAPACITY; slot++) {
    if (!isActive(world, slot)) continue;
    advanceBear(world, slot, stage, matchFrame);
    advanceCompanion(world, slot, stage, matchFrame);
  }
  if (ownsBatch) finishDamageContacts(world);
}


function heroContactEffect(contact: Readonly<HitRegion>, target: Readonly<Fighter>): Readonly<HitEffect> {
  return target.motion.grounded && contact.groundedEffect !== undefined ? contact.groundedEffect : contact.effect;
}

function heroAction(action: number): SpecialAction {
  switch (action) {
    case SpecialAction.heroSide: return SpecialAction.heroSide;
    case SpecialAction.heroUp: return SpecialAction.heroUp;
    case SpecialAction.heroDown: return SpecialAction.heroDown;
    default: return SpecialAction.heroNeutral;
  }
}
