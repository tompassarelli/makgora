import { EYE_BEAM_EX_REACH, EYE_BEAM_REACH } from "../sim/eyeBeam";









import { f32 } from "wisp/src/sim/f32";
import { floorDiv } from "wisp/src/sim/intMath";
import { toInt } from "wisp/src/sim/binary32";
import { hurtCapsule } from "../sim/geometry/contactGeometry";
import { AttackStyle, Character, DownState, HeroStatusKind, ProjectileKind, SpecialAction } from "../sim/codes";
import { canAttack } from "../sim/conditions";
import { type Fighter, placedObject } from "../sim/fighter";
import { type AttackBuffer, queueAttack } from "../input/attackBuffer";
import { attackStartupFrames, characterAttackActiveFrames } from "../sim/moves";
import { aimedProjectile, companionReady, isHeroSpecialAction, runningHeroSpecial, specialCooldownReady, steeredShot } from "../sim/specials/engine";
import { heroStatusBlocksActions } from "../sim/heroStatus";
import { type AuthoredSpecial, type SpecialFollowUp, type SpecialProjectile, CompanionOrder, FOLLOW_UP_FORM, FollowUpInput, SpecialSlot, specialKit } from "../sim/specials/schema";
import type { Controls } from "../sim/roster";
import {
  FEL_RUSH_SPEED, FEL_RUSH_FIRST, FEL_RUSH_LAST, DEMONHUNTER_DIVE_FRAME, DEMONHUNTER_DIVE_FRAMES, DEMONHUNTER_DIVE_SPEED, DEMONHUNTER_IMMOLATE_JUMP_CANCEL,
  RIFLEMAN_RECOVERY_STARTUP_FRAMES, RIFLEMAN_SECOND_SHOT_FIRST, RIFLEMAN_SECOND_SHOT_FORM, RIFLEMAN_SECOND_SHOT_LAST,
} from "../sim/specials";
import { floorBelow, mainDeckLeft, mainDeckRight, mainDeckZ } from "../sim/stage";
import { safeAt, steerOnGround } from "./botFooting";
import { HeroSpecialUse, autoFollowUpDue, heroSpecialUse, holdFirstPartZone, startableForm, strikeMeets } from "./botHeroKit";
import { aheadX, moveReachAhead } from "./botMoves";
import { botChance, botChoice } from "./botRandom";
import type { CpuSkill } from "./cpuSkill";
import { ULTIMATE_FRAMES_PER_PERCENT, exCharged, ultimateCharged, ultimatePercent } from "../sim/meter";
import { ULTIMATE_REACH } from "./botUltimateReach";


const FEINT_GAP = 110.0;

const BAIT_LATEST = 40;

const IMAGE_NEAR = 110.0;
const IMAGE_FAR = 330.0;
const IMAGE_ROOM = 160.0;

const ARMOR_GAP = 240.0;

const PARTNER_BITE_REACH = 60.0;
const PARTNER_STRAY = f32(0.2);

const RITUAL_MANA = 25;
const RITUAL_GAP = 200.0;
const RITUAL_LAST_FRAMES = 30;



const SHOT_NEAR = 180.0;
const SHOT_FAR = 620.0;
const SHOT_RISE = 70.0;

const LEVEL_REACH = 140.0;
const LEVEL_BELOW = 20.0;
const LEVEL_ABOVE = 40.0;

const DIVE_AIM_DEAD = 60.0;

const RUSH_NEAR = 80.0;
const RUSH_PAST = 40.0;



const ANTI_AIR_GAP = 140.0;
const ANTI_AIR_RISE = 160.0;

const DASH_IN_FAR = 300.0;


const affords = (f: Readonly<Fighter>, action: SpecialAction): boolean => specialCooldownReady(f, action);

const HERO_SLOTS = [SpecialSlot.neutral, SpecialSlot.side, SpecialSlot.up, SpecialSlot.down] as const;


const takes = (skill: CpuSkill, first: number, second: number): boolean => botChance(first, second, skill.kitTenths, 10);


const actionSeed = (f: Readonly<Fighter>): number => f.attack.serial * 37 + floorDiv(f.meter.ultimate, ULTIMATE_FRAMES_PER_PERCENT) * 11 + (exCharged(f) ? 7 : 0) + toInt(f.status.damage);

const towardOf = (f: Readonly<Fighter>, x: number): number => (x === f.motion.x ? f.facing : x > f.motion.x ? 1 : -1);

function pressSlot(input: Controls, slot: SpecialSlot, side: number): void {
  input.specialPressed = true;
  input.specialX = slot === SpecialSlot.side ? side : 0;
  input.specialZ = slot === SpecialSlot.up ? 1 : slot === SpecialSlot.down ? -1 : 0;
  input.verticalDirection = input.specialZ;
  input.direction = side;
}

function branchBy(followUps: readonly SpecialFollowUp[], kind: FollowUpInput, strikes: boolean): SpecialFollowUp | undefined {
  for (const branch of followUps) {
    if ((branch.input ?? FollowUpInput.special) !== kind) continue;
    if (((branch.special.regions ?? []).length > 0) === strikes) return branch;
  }
  return undefined;
}


function fullestBranch(followUps: readonly SpecialFollowUp[]): SpecialFollowUp | undefined {
  let fullest: SpecialFollowUp | undefined;
  for (const branch of followUps) {
    if ((branch.input ?? FollowUpInput.special) !== FollowUpInput.special) continue;
    if (fullest === undefined || branch.window.first > fullest.window.first) fullest = branch;
  }
  return fullest;
}








export function steerHeroBranches(f: Readonly<Fighter>, target: Readonly<Fighter>, skill: CpuSkill, input: Controls): boolean {
  if (!isHeroSpecialAction(f.special.action) || f.special.form >= FOLLOW_UP_FORM || f.launch.hitstun > 0) return false;
  const followUps = runningHeroSpecial(f)?.followUps;
  if (followUps === undefined) return false;
  const seed = actionSeed(f);
  if (!takes(skill, seed, f.character * 7 + 1)) return false;
  const next = f.special.frame + 1;
  const strike = branchBy(followUps, FollowUpInput.attack, true);
  const stepOut = branchBy(followUps, FollowUpInput.special, false);
  if (stepOut !== undefined && strike === undefined) {

    if (next < stepOut.window.first || next > stepOut.window.last) return false;
    const answered = target.attack.style !== undefined || !target.motion.grounded || target.shield.raised;
    const planned = botChoice(seed, f.character * 7 + 19, 3) === 0 && next >= stepOut.window.last - 2;
    if (!answered && !planned) return false;
    input.specialPressed = true;
    return true;
  }
  const hold = branchBy(followUps, FollowUpInput.shield, false);
  const fullest = fullestBranch(followUps);
  if (hold === undefined || fullest === undefined || next < hold.window.first || next > hold.window.last) return false;

  const mode = botChoice(seed, f.character * 7 + 3, 3);
  if (mode === 0) return false;
  if (mode === 1) return next < fullest.window.first;

  if (target.shield.raised || !target.motion.grounded || next >= BAIT_LATEST) {
    input.shield = true;
    input.shieldPressed = true;
  }
  return true;
}


function ownProjectile(f: Readonly<Fighter>, spec: Readonly<SpecialProjectile> | undefined) {
  for (const projectile of f.projectiles) {
    if (projectile.life <= 0 || projectile.kind !== ProjectileKind.hero || projectile.spec === undefined) continue;
    if (spec !== undefined) {
      if (projectile.spec === spec) return projectile;
      continue;
    }
    const returns = projectile.spec.returns;
    if (returns !== undefined && projectile.damageMultiplier === 1.0 && projectile.life > projectile.spec.life - returns.age) return projectile;
  }
  return undefined;
}


function pressRecall(f: Readonly<Fighter>, target: Readonly<Fighter>, move: Readonly<AuthoredSpecial>, slot: SpecialSlot, skill: CpuSkill, frame: number, input: Controls): boolean {
  const body = hurtCapsule(target.character);
  const { motion } = target;
  for (const segment of move.motion ?? []) {
    if (segment.relocate === undefined) continue;

    const { placed } = f;
    if (placed.life <= 0 || !strikeMeets(move, target, f32(f32(motion.x - placed.x) * placed.direction), f32(motion.z - placed.z))) return false;
    if (!takes(skill, placed.serial, f.character * 7 + 4)) return false;
    pressSlot(input, slot, 0);
    return true;
  }
  if (move.recallsProjectiles === true) {

    const hammer = ownProjectile(f, undefined);
    if (hammer === undefined) return false;
    const between = (motion.x - hammer.x) * (f.motion.x - motion.x) > 0 && Math.abs(f32(motion.x - hammer.x)) > body.radius;
    const level = Math.abs(f32(f32(f32(motion.z + f32(f32(body.z1 + body.z2) * 0.5)) - hammer.z))) <= f32(f32(body.z2 - body.z1) * 0.5 + 30.0);
    if (!between || !level || !takes(skill, hammer.serial, f.character * 7 + 5)) return false;
    pressSlot(input, slot, 0);
    return true;
  }
  if (move.burst !== undefined) {

    const orb = ownProjectile(f, move.burst.from);
    if (orb === undefined) return false;
    const reach = f32(move.burst.into.radius + body.radius);
    const inside = Math.abs(f32(motion.x - orb.x)) <= reach && orb.z >= f32(f32(motion.z + body.z1) - reach) && orb.z <= f32(f32(motion.z + body.z2) + reach);
    if (!inside || !takes(skill, orb.serial, f.character * 7 + 6)) return false;
    pressSlot(input, slot, 0);
    return true;
  }
  const order = move.command?.order;
  const animal = placedObject(f, move.command?.slot);
  const partner = animal.spec?.companion;
  if (order !== undefined && partner !== undefined && animal.life > 0) {
    const fromPartner = f32(motion.x - animal.x);
    if (order === CompanionOrder.lunge) {

      const shot = animal.spec?.shot;
      const reach = partner.behavior === "sentry" && shot !== undefined ? f32(shot.velocityX * shot.life) : f32(f32(partner.lungeTravel + body.radius) + PARTNER_BITE_REACH);
      const height = f32(animal.z - motion.z);
      const withinHeight = partner.behavior === "flying" ? height >= -body.z2 && height <= f32((partner.lungeDrop ?? 0.0) + body.z2) : Math.abs(height) <= 60.0;
      if (!companionReady(f, move.command?.slot) || Math.abs(fromPartner) > reach || !withinHeight || !takes(skill, floorDiv(frame, 20), f.character * 7 + 22 + slot)) return false;
      pressSlot(input, slot, fromPartner < 0 ? -1 : 1);
      return true;
    }

    if (Math.abs(f32(animal.x - f.motion.x)) < f32(partner.leash * PARTNER_STRAY) || !takes(skill, floorDiv(frame, 30), f.character * 7 + 23)) return false;
    pressSlot(input, slot, 0);
    return true;
  }
  if (move.ritual !== undefined) {

    const cash = (f.meter.ultimate < ultimatePercent(RITUAL_MANA) && Math.abs(f32(motion.x - f.motion.x)) >= RITUAL_GAP) || f.status.armorFrames <= RITUAL_LAST_FRAMES;
    if (!cash || !takes(skill, floorDiv(frame, 30), f.character * 7 + 7)) return false;
    pressSlot(input, slot, 0);
    return true;
  }
  return false;
}


function pressHeroOption(f: Readonly<Fighter>, target: Readonly<Fighter>, stage: number, skill: CpuSkill, frame: number, ready: boolean, input: Controls): boolean {
  const specials = f.tuning.specials;
  if (specials === undefined || !canAttack(f) || f.special.action !== SpecialAction.none) return false;
  const dx = f32(target.motion.x - f.motion.x);
  const gap = Math.abs(dx);
  const toward = towardOf(f, target.motion.x);
  const level = Math.abs(f32(target.motion.z - f.motion.z)) <= 60.0;


  const open = f.status.divineFrames > 0 || heroStatusBlocksActions(target) || target.status.frozenFrames > 0 || target.status.condition === HeroStatusKind.hex;
  const closeReach = open ? Math.max(50.0, moveReachAhead(f.character, AttackStyle.forwardTilt, target, f.tuning.moves)) : 50.0;
  const closeGap = open ? Math.abs(aheadX(f, target, attackStartupFrames(AttackStyle.forwardTilt, f.tuning.moves), AttackStyle.forwardTilt)) : gap;
  if (open && f.motion.grounded && closeGap > closeReach && takes(skill, floorDiv(frame, 45), f.character * 7 + 18)) {

    if (f.status.divineFrames > 0 && ready) for (const slot of HERO_SLOTS) {
      if (heroSpecialUse(f, target, stage, slot) !== HeroSpecialUse.ranged) continue;
      pressSlot(input, slot, toward);
      return true;
    }
    steerOnGround(f, stage, target.motion.x, input);
    return true;
  }

  if (ready && f.motion.grounded && !target.motion.grounded && target.motion.vz < 0 && gap <= ANTI_AIR_GAP && f32(target.motion.z - f.motion.z) >= 30.0
    && f32(target.motion.z - f.motion.z) <= ANTI_AIR_RISE && f.jump.squat <= 0 && botChoice(floorDiv(frame, 20), f.character * 7 + 28, 3) === 0
    && takes(skill, floorDiv(frame, 20), f.character * 7 + 29)) {
    input.jumpPressed = true;
    input.jumpHeld = true;
    return true;
  }
  for (const slot of HERO_SLOTS) {
    const kit = specialKit(specials, slot);

    const move = startableForm(f, specials, slot);
    if (move === undefined) continue;
    if (move === kit.recall) {
      if (pressRecall(f, target, move, slot, skill, frame, input)) return true;
      continue;
    }
    if (!ready || !f.motion.grounded) continue;

    if (move.placement !== undefined && move.placement.shot === undefined && (move.regions ?? []).length === 0 && placedObject(f, move.placement.slot).life <= 0
      && gap >= IMAGE_NEAR && gap <= IMAGE_FAR && level && safeAt(stage, f32(f.motion.x - f32(toward * IMAGE_ROOM)), 0.0)
      && botChoice(floorDiv(frame, 45), f.character * 7 + 9, 3) === 0 && takes(skill, floorDiv(frame, 45), f.character * 7 + 10)) {
      pressSlot(input, slot, toward);
      return true;
    }

    if (move.armor?.shell === true && (move.regions ?? []).length === 0 && f.status.armorFrames <= 0 && gap >= ARMOR_GAP
      && botChoice(floorDiv(frame, 45), f.character * 7 + 11, 3) === 0 && takes(skill, floorDiv(frame, 45), f.character * 7 + 12)) {
      pressSlot(input, slot, 0);
      return true;
    }
  }
  return false;
}









function ultimateBaseZ(f: Readonly<Fighter>, move: Readonly<AuthoredSpecial>, stage: number, stageFrame: number): number | undefined {
  if (f.motion.grounded) return f.motion.z;
  if (move.groundOnly === true || f.motion.x < mainDeckLeft(stage) || f.motion.x > mainDeckRight(stage)) return undefined;
  if (move.needsFloorBelow !== true) return f.motion.z;
  return floorBelow(stage, stageFrame, f.motion.x, f.motion.z);
}

export function pressUltimate(f: Readonly<Fighter>, target: Readonly<Fighter>, stage: number, stageFrame: number, skill: CpuSkill, frame: number, input: Controls): boolean {
  const reach = ULTIMATE_REACH[f.character];
  const move = f.tuning.ultimate;
  if (reach === undefined || move === undefined || reach.far <= 0.0 || skill.tier === "rookie" || skill.kitTenths <= 0) return false;
  if (!ultimateCharged(f) || !canAttack(f) || f.special.action !== SpecialAction.none || f.launch.hitstun > 0) return false;
  const base = ultimateBaseZ(f, move, stage, stageFrame);
  if (base === undefined) return false;
  const dx = f32(target.motion.x - f.motion.x);
  const gap = Math.abs(dx);
  const rise = f32(target.motion.z - base);
  const aloft = f.character === Character.lich ? !target.motion.grounded && rise >= 90.0 && rise <= 220.0 : Math.abs(rise) <= 80.0;
  if (gap < reach.near || gap > reach.far || !aloft || target.shield.raised || target.status.out) return false;
  if (!takes(skill, floorDiv(frame, 20), f.character * 7 + 40)) return false;
  const toward = towardOf(f, target.motion.x);
  input.specialPressed = true;
  input.ultimatePressed = true;
  input.attackHeld = true;
  input.specialX = toward;
  input.specialZ = 0;
  input.direction = toward;
  return true;
}


export function pressKitOption(f: Readonly<Fighter>, target: Readonly<Fighter>, stage: number, skill: CpuSkill, frame: number, ready: boolean, input: Controls, commands: AttackBuffer): boolean {
  if (skill.kitTenths <= 0 || f.launch.hitstun > 0) return false;
  if (f.tuning.specials !== undefined) return pressHeroOption(f, target, stage, skill, frame, ready, input);
  const { motion } = f;
  const dx = f32(target.motion.x - motion.x);
  const gap = Math.abs(dx);
  const toward = towardOf(f, target.motion.x);
  const free = canAttack(f) && f.special.action === SpecialAction.none;
  switch (f.character) {
    case Character.rifleman: {
      if (!free || !ready || toward !== f.facing || gap < SHOT_NEAR || gap > SHOT_FAR || !affords(f, SpecialAction.riflemanBlaster)) return false;
      const rise = f32(motion.z - target.motion.z);
      if (!takes(skill, floorDiv(frame, 40), f.character * 7 + 14) || botChoice(floorDiv(frame, 40), f.character * 7 + 15, 2) !== 0) return false;
      if (motion.grounded) {

        if (Math.abs(rise) > 30.0 || f.jump.squat > 0) return false;
        input.jumpPressed = true;
        input.jumpHeld = false;
        return true;
      }
      if (rise < 0.0 || rise > SHOT_RISE) return false;
      pressSlot(input, SpecialSlot.neutral, 0);
      return true;
    }
    case Character.demonHunter: {

      if (free && ready && motion.grounded && target.motion.grounded && toward === f.facing && gap > EYE_BEAM_REACH && gap <= EYE_BEAM_EX_REACH && exCharged(f) && affords(f, SpecialAction.demonHunterEyeBeam)
        && Math.abs(f32(target.motion.z - motion.z)) <= 40.0 && takes(skill, floorDiv(frame, 30), f.character * 7 + 24) && botChoice(floorDiv(frame, 30), f.character * 7 + 25, 3) === 0) {
        pressSlot(input, SpecialSlot.neutral, 0);
        input.exPressed = true;
        return true;
      }

      const rush = f32(FEL_RUSH_SPEED * (FEL_RUSH_LAST - FEL_RUSH_FIRST + 1));
      if (!free || !ready || !motion.grounded || toward !== f.facing || gap < RUSH_NEAR || gap > rush || Math.abs(f32(target.motion.z - motion.z)) > 60.0
        || !safeAt(stage, f32(motion.x + f32(f.facing * rush)), 0.0) || !affords(f, SpecialAction.demonHunterFelRush)
        || !takes(skill, floorDiv(frame, 30), f.character * 7 + 20) || botChoice(floorDiv(frame, 30), f.character * 7 + 21, 2) !== 0) return false;
      pressSlot(input, SpecialSlot.side, toward);
      return true;
    }
  }
  return false;
}








function steerWingDive(f: Readonly<Fighter>, target: Readonly<Fighter> | undefined, stage: number, floor: number, home: number, outside: number, input: Controls): boolean {
  const { special, motion } = f;
  if (special.form !== 0 || special.frame !== DEMONHUNTER_DIVE_FRAME) return false;
  if (outside > 0.0) {
    aimDive(input, home, motion.z < f32(floor + LEVEL_ABOVE) ? 1 : 0);
    return true;
  }
  const dx = target === undefined ? 0.0 : f32(target.motion.x - motion.x);
  const dz = target === undefined ? 0.0 : f32(target.motion.z - motion.z);
  const reach = f32(DEMONHUNTER_DIVE_SPEED * DEMONHUNTER_DIVE_FRAMES);
  if (target === undefined || f32(f32(dx * dx) + f32(dz * dz)) > f32(reach * reach) || !safeAt(stage, target.motion.x, 0.0)) {
    holdFirstPartZone(f, input);
    return true;
  }
  aimDive(input, Math.abs(dx) <= DIVE_AIM_DEAD ? 0 : dx < 0 ? -1 : 1, Math.abs(dz) <= DIVE_AIM_DEAD ? 0 : dz < 0 ? -1 : 1);
  return true;
}

function aimDive(input: Controls, aimX: number, aimZ: number): void {
  input.diStickValid = false;
  input.direction = aimX;
  input.verticalDirection = aimZ;
}


export function holdAimAtFoe(f: Readonly<Fighter>, target: Readonly<Fighter> | undefined, input: Controls): void {
  const rune = aimedProjectile(f);
  if (rune !== undefined) input.specialHeld = target !== undefined && f32(f32(target.motion.x - rune.x) * f.facing) > 0.0;
}

const SHOT_AIM_DEAD = 12.0;
const SHOT_AIM_HEIGHT = 45.0;

export function steerShotAtFoe(f: Readonly<Fighter>, target: Readonly<Fighter> | undefined, input: Controls): boolean {
  const shot = steeredShot(f);
  if (shot === undefined) return false;
  input.diStickValid = false;
  input.shield = false;
  input.shieldPressed = false;
  input.specialPressed = target === undefined || target.status.out;
  if (target === undefined) return true;
  const dx = f32(target.motion.x - shot.x);
  const dz = f32(f32(target.motion.z + SHOT_AIM_HEIGHT) - shot.z);
  input.direction = Math.abs(dx) <= SHOT_AIM_DEAD ? 0 : dx < 0 ? -1 : 1;
  input.verticalDirection = Math.abs(dz) <= SHOT_AIM_DEAD ? 0 : dz < 0 ? -1 : 1;
  return true;
}

export function steerRunningSpecial(f: Readonly<Fighter>, target: Readonly<Fighter> | undefined, stage: number, skill: CpuSkill, input: Controls): boolean {
  const { special, motion } = f;
  if (special.action === SpecialAction.none || f.launch.hitstun > 0 || f.launch.hitlag > 0) return false;
  const seed = actionSeed(f);
  const dive = special.action === SpecialAction.demonHunterWingAscent && special.form === 0 && special.frame === DEMONHUNTER_DIVE_FRAME;
  const skilled = skill.kitTenths > 0 && takes(skill, seed, f.character * 7 + 17);
  if (autoFollowUpDue(f) || (dive && !skilled)) {
    holdFirstPartZone(f, input);
    return true;
  }
  if (!skilled) return false;
  const left = mainDeckLeft(stage);
  const right = mainDeckRight(stage);
  const floor = mainDeckZ(stage);
  const home = motion.x < 0 ? 1 : -1;
  const outside = motion.x < left ? f32(left - motion.x) : motion.x > right ? f32(motion.x - right) : 0.0;
  const next = special.frame + 1;
  switch (special.action) {
    case SpecialAction.riflemanRecovery: {
      if (outside <= 0.0 && motion.z >= floor) return false;
      const level = outside > LEVEL_REACH && motion.z > f32(floor - LEVEL_BELOW);
      if (next <= RIFLEMAN_RECOVERY_STARTUP_FRAMES) {

        input.direction = home;
        input.verticalDirection = level ? 0 : 1;
        return true;
      }
      if (special.form === RIFLEMAN_SECOND_SHOT_FORM || next < RIFLEMAN_SECOND_SHOT_FIRST || next > RIFLEMAN_SECOND_SHOT_LAST) return false;

      if (motion.vz > 4.0 && next < RIFLEMAN_SECOND_SHOT_LAST) return false;
      input.specialPressed = true;
      input.specialX = home;
      input.specialZ = level ? 0 : 1;
      input.direction = home;
      input.verticalDirection = input.specialZ;
      return true;
    }
    case SpecialAction.demonHunterFelRush: {
      if (next < FEL_RUSH_FIRST || next >= FEL_RUSH_LAST) return false;
      const passed = target !== undefined && f32(f32(target.motion.x - motion.x) * f.facing) < -RUSH_PAST;
      if (!passed && safeAt(stage, f32(motion.x + f32(f.facing * FEL_RUSH_SPEED)), 0.0)) return false;
      input.specialPressed = true;
      return true;
    }
    case SpecialAction.demonHunterImmolate:

      if (special.frame < DEMONHUNTER_IMMOLATE_JUMP_CANCEL || (!motion.grounded && f.jump.remaining <= 0)) return false;
      input.jumpPressed = true;
      input.jumpHeld = target !== undefined && f32(target.motion.z - motion.z) > 60.0;
      return true;
    case SpecialAction.demonHunterWingAscent:
      return steerWingDive(f, target, stage, floor, home, outside, input);
  }
  return false;
}


function punishable(target: Readonly<Fighter>): boolean {
  const style = target.attack.style;
  if (target.landing.lag > 0 || target.down.state !== DownState.none) return true;
  return style !== undefined && target.attack.frame > attackStartupFrames(style, target.tuning.moves) + characterAttackActiveFrames(target.character, style, target.tuning.moves);
}







export function dashIn(f: Readonly<Fighter>, target: Readonly<Fighter>, stage: number, skill: CpuSkill, frame: number, closes: boolean, input: Controls): void {
  if (skill.kitTenths <= 0 || !f.motion.grounded || (f.tuning.moves?.dashAttack === undefined && f.character !== Character.demonHunter)) return;
  const dx = f32(target.motion.x - f.motion.x);
  if (Math.abs(dx) > DASH_IN_FAR || Math.abs(f32(target.motion.z - f.motion.z)) > 40.0 || target.shield.raised || !safeAt(stage, target.motion.x, 0.0)) return;
  const stretch = floorDiv(frame, 40);
  if (!punishable(target) && !(closes && botChoice(stretch, f.character * 7 + 26, 8) === 0)) return;
  if (!takes(skill, stretch, f.character * 7 + 27)) return;
  input.walking = false;
  input.direction = dx < 0 ? -1 : 1;
}
