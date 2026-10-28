

import { max, min } from "../core/numbers";
import { f32 } from "wisp/src/sim/f32";
import { idiv } from "wisp/src/sim/intMath";
import { AttackPhase, AttackStyle, Character, DownState, GrabAction, LedgeState, ParasolState, ShieldBreak, SpecialAction, SurfaceContact } from "../sim/codes";
import { type CommandGrab, FOLLOW_UP_FORM, SpecialForm } from "../sim/specials/schema";

import { GROUND_ROLL_FRAMES, SPOT_DODGE_FRAMES, WALL_TECH_STARTUP_FRAMES, attackPhase, inGrabContext, isForwardGroundRoll, isGroundDodging } from "../sim/conditions";
import { DOWN_BOUND_FRAMES, DOWN_DAMAGE_FRAMES, DOWN_ROLL_FRAMES, DOWN_STAND_FRAMES, TECH_IN_PLACE_FRAMES, TECH_ROLL_FRAMES } from "../sim/down";
import type { Fighter } from "../sim/fighter";
import { AIR_DODGE_ANIMATION_FRAMES } from "../sim/jumpsAndDodges";
import { LEDGE_CLIMB_FRAMES, LEDGE_ROLL_FRAMES } from "../sim/ledge";
import { totalVelocityX } from "../sim/motion";
import { LEDGE_ATTACK_FRAMES, RIFLEMAN_BLASTER_AIR_FRAMES, attackStartupFrames, characterAttackActiveFrames, grabActionDuration, grabContactFrame, isSmashAttack, smashChargeFrame } from "../sim/moves";
import { type Controls, type Roster, fighterAt } from "../sim/roster";
import { SHIELD_RELEASE_LAG_FRAMES } from "../sim/shield";
import { INITIAL_DASH_FRAMES, SHIELD_BREAK_LAND_FRAMES, SHIELD_BREAK_STAND_FRAMES, authoredPhysics } from "../sim/tuning";
import { DamagePose, contactDamageClip, damagePose } from "./damagePose";
import * as dh from "./demonHunterAssetInfo";
import { disabledPose } from "./disabledPose";
import type { HeroClip, HeroClipTable, HeroPose } from "../sim/heroes/hero";
import * as clips from "./fighterClips";
import { refireClipFrames, refireKey, refiredClip } from "./specialRefire";
import { groundLocomotionClip, groundLocomotionRate } from "./fighterLocomotion";
import { koboldLocomotionClips } from "../fighters/kobold/locomotion";
import { HERO_STRIKE_MOMENTS } from "./heroStrikeMomentInfo";
import { SPECIAL_KEY } from "./heroStrikeMomentKeys";
import { heroCueWindows } from "./cueWindows";
import { FRAME_SECONDS } from "./frameClock";
import { peonSpecialPose } from "./peonPose";
import { runningHeroSpecial } from "../sim/specials/engine";
import { heroLook } from "../roster/looks";
import {
  ESCAPE_FRAMES, IllidanLocomotion, LEDGE_CATCH_FRAMES, RESPAWN_FRAMES, TRANSITION_FRAMES, type IllidanMotion,
  advanceIllidanMotion, clearIllidanMotion, copyIllidanMotion, createIllidanMotion, firstIllidanMotionDifference,
} from "./illidanMotion";


const playsFollowUpPose = (f: Readonly<Fighter>): boolean => f.special.form >= FOLLOW_UP_FORM || f.special.form === SpecialForm.recall;


const REACTION_CLIP_FRAMES = 24;
const JUMP_CLIP_FRAMES = 24;
const DOUBLE_JUMP_CLIP_FRAMES = 30;
export const CROUCH_CLIP_FRAMES = 24;
const SHIELD_RAISE_FRAMES = 4;






export interface FighterPose {

  animation: string;
  jumpAnimationRemaining: number;
  doubleJumpAnimation: boolean;

  landingAnimationRate: number;
  readonly motion: IllidanMotion;

  clipIndex: number | undefined;
  clipName: string;
  clipTime: number;
  rate: number;

  selectionSerial: number;
}

export function createFighterPose(): FighterPose {
  return {
    animation: "", jumpAnimationRemaining: 0, doubleJumpAnimation: false, landingAnimationRate: 1.0,
    motion: createIllidanMotion(), clipIndex: undefined, clipName: "stand", clipTime: 0.0, rate: 1.0, selectionSerial: 0,
  };
}

export function clearFighterPose(pose: FighterPose): void {
  pose.animation = "";
  pose.jumpAnimationRemaining = 0;
  pose.doubleJumpAnimation = false;
  pose.landingAnimationRate = 1.0;
  clearIllidanMotion(pose.motion);
  pose.clipIndex = undefined;
  pose.clipName = "stand";
  pose.clipTime = 0.0;
  pose.rate = 1.0;
  pose.selectionSerial = 0;
}


export function copyFighterPoseInto(target: FighterPose, source: Readonly<FighterPose>, sourceWorld: Readonly<Roster>): void {
  target.animation = source.animation;
  target.jumpAnimationRemaining = source.jumpAnimationRemaining;
  target.doubleJumpAnimation = source.doubleJumpAnimation;
  target.landingAnimationRate = source.landingAnimationRate;
  target.clipIndex = source.clipIndex;
  target.clipName = source.clipName;
  target.clipTime = source.clipTime;
  target.rate = source.rate;
  target.selectionSerial = source.selectionSerial;
  copyIllidanMotion(target.motion, source.motion, sourceWorld);
}

export function firstFighterPoseDifference(
  expected: Readonly<FighterPose>, actual: Readonly<FighterPose>, world: Readonly<Roster>, actualWorld: Readonly<Roster>,
): string | undefined {
  if (expected.animation !== actual.animation) return "animation";
  if (expected.jumpAnimationRemaining !== actual.jumpAnimationRemaining) return "jumpAnimationRemaining";
  if (expected.doubleJumpAnimation !== actual.doubleJumpAnimation) return "doubleJumpAnimation";
  if (expected.landingAnimationRate !== actual.landingAnimationRate) return "landingAnimationRate";
  if (expected.clipIndex !== actual.clipIndex) return "clipIndex";
  if (expected.clipName !== actual.clipName) return "clipName";
  if (expected.clipTime !== actual.clipTime) return "clipTime";
  if (expected.rate !== actual.rate) return "rate";
  if (expected.selectionSerial !== actual.selectionSerial) return "selectionSerial";
  return firstIllidanMotionDifference(expected.motion, actual.motion, world, actualWorld);
}

export function selectFighterClipIndex(pose: FighterPose, index: number): void {
  pose.clipIndex = index;
  pose.clipName = "";
  pose.clipTime = 0.0;
  pose.selectionSerial++;
}

export function selectFighterClipName(pose: FighterPose, name: string): void {
  pose.clipIndex = undefined;
  pose.clipName = name;
  pose.clipTime = 0.0;
  pose.selectionSerial++;
}


const MOTION_KEYS: Record<number, string | undefined> = {};

function motionKey(motion: number): string {
  const known = MOTION_KEYS[motion];
  if (known !== undefined) return known;
  const key = `motion${motion}`;
  MOTION_KEYS[motion] = key;
  return key;
}

function playIndex(pose: FighterPose, key: string, index: number): void {
  if (pose.animation === key) return;
  selectFighterClipIndex(pose, index);
  pose.animation = key;
}

const GAIT_KEYS: ReadonlySet<string> = new Set([motionKey(IllidanLocomotion.walk), motionKey(IllidanLocomotion.dash), motionKey(IllidanLocomotion.run), "walk"]);

function playLocomotionIndex(pose: FighterPose, key: string, index: number, entry = 0.0): void {
  if (pose.clipIndex === index && GAIT_KEYS.has(key) && GAIT_KEYS.has(pose.animation)) {
    pose.animation = key;
    return;
  }
  if (pose.clipIndex !== index) pose.animation = "";
  if (pose.animation === key) return;
  selectFighterClipIndex(pose, index);
  pose.clipTime = entry;
  pose.animation = key;
}

function playName(pose: FighterPose, key: string, name: string): void {
  if (pose.animation === key) return;
  selectFighterClipName(pose, name);
  pose.animation = key;
}


const clipRate = (seconds: number, frames: number): number => f32(seconds / f32(frames * FRAME_SECONDS));





export function advanceFighterPose(
  pose: FighterPose, fighter: Readonly<Fighter>, world: Readonly<Roster>, controls: Readonly<Controls>,
  wasOut: boolean, jumped: boolean, attacked: boolean, hit: boolean,
): void {


  pose.clipTime = f32(pose.clipTime + f32(pose.rate * FRAME_SECONDS));
  const phase = attackPhase(fighter);
  const charging = fighter.attack.smashCharging || (fighter.attack.smashChargeAllowed && controls.attackHeld && isSmashAttack(fighter.attack.style));
  if (attacked && phase !== AttackPhase.none && !charging) selectAttackClip(pose, fighter);
  advanceIllidanMotion(pose.motion, fighter, controls, world);
  if (hit) {
    pose.motion.escapeRemaining = 0;
    pose.motion.respawnRemaining = 0;
  }
  if (fighter.status.out) {
    const ko = fighter.character === Character.demonHunter ? dh.DEMON_HUNTER_KO_INDEX : clips.characterClips(fighter.character).ko?.index;
    if (ko !== undefined && !wasOut) {
      selectFighterClipIndex(pose, ko);
      pose.rate = 1.0;
      pose.animation = "ko";
    }
    return;
  }
  if (fighter.status.frozenFrames > 0) {
    pose.rate = 0.0;
    return;
  }
  advanceJumpClip(pose, fighter, phase, wasOut, jumped);
  const rate = selectClip(pose, fighter, world, phase, hit, charging);


  const stopped = pose.animation === motionKey(IllidanLocomotion.stop) && pose.motion.transitionRemaining === 0;
  pose.rate = fighter.launch.hitlag > 0 || charging || stopped ? 0.0 : rate;
}

function advanceJumpClip(pose: FighterPose, f: Readonly<Fighter>, phase: AttackPhase, wasOut: boolean, jumped: boolean): void {
  const busy = f.motion.grounded || f.launch.hitstun > 0 || f.dodge.airDodging || phase !== AttackPhase.none
    || f.special.action !== SpecialAction.none || f.down.state !== DownState.none
    || f.shield.breakState !== ShieldBreak.none || f.ledge.state !== LedgeState.none;
  if (busy) pose.jumpAnimationRemaining = 0;
  else if (jumped && !wasOut) {
    pose.doubleJumpAnimation = f.jump.isDouble;
    pose.jumpAnimationRemaining = pose.doubleJumpAnimation ? DOUBLE_JUMP_CLIP_FRAMES : JUMP_CLIP_FRAMES;
    pose.animation = "";
  } else if (pose.jumpAnimationRemaining > 0 && f.launch.hitlag <= 0) pose.jumpAnimationRemaining--;

  if (f.character === Character.demonHunter && f.motion.vz < 0 && !pose.motion.ledgeJump) pose.jumpAnimationRemaining = 0;
}


const posesDown = (f: Readonly<Fighter>): boolean =>
  f.down.state !== DownState.none && f.down.state !== DownState.tumble && f.down.state !== DownState.attack;


const holdsSpecialEnd = (pose: Readonly<FighterPose>, f: Readonly<Fighter>): boolean =>
  f.special.lockFrames > 0 && f.motion.grounded && f.landing.lag <= 0
  && pose.animation.startsWith("special") && pose.animation !== "specialfall";


/** A caught phase shorter than its clip plays the clip faster to fit. */
function commandGrabSqueeze(clipSeconds: number, grab: Readonly<CommandGrab>, holding: boolean, caught: boolean): number {
  const phaseFrames = holding ? grab.holdFrames : caught ? grab.recovery : 0;
  return phaseFrames > 0 ? max(1.0, clipRate(clipSeconds, phaseFrames)) : 1.0;
}


function selectCommandGrabClip(pose: FighterPose, f: Readonly<Fighter>): boolean {
  if (f.special.action === SpecialAction.none || f.grab.owner !== undefined || f.launch.hitstun !== 0) return false;
  const clips = heroLook(f.character)?.commandGrab;
  const move = clips === undefined ? undefined : runningHeroSpecial(f);
  const grab = move?.commandGrab;
  if (clips === undefined || move === undefined || grab === undefined) return false;
  const caught = f.special.grabFrame;
  const charge = move.motion?.[move.motion.length - 1]?.last ?? grab.last;
  const holding = caught > 0 && f.special.frame < caught + grab.holdFrames;
  const recovering = !holding && (caught > 0 || f.special.frame > charge);
  const phase = holding ? "hold" : recovering ? "recovery" : "travel";
  const first = holding ? caught : recovering ? caught > 0 ? caught + grab.holdFrames : charge + 1 : 1;
  playIndex(pose, `commandGrab-${phase}`, clips[phase].index);
  pose.clipTime = f32(f32(Math.max(0, f.special.frame - first) * FRAME_SECONDS) * commandGrabSqueeze(clips[phase].seconds, grab, holding, caught > 0));
  return true;
}


function selectClip(pose: FighterPose, f: Readonly<Fighter>, world: Readonly<Roster>, phase: AttackPhase, hit: boolean, charging: boolean): number {
  const reaction = damagePose(f);
  const rate = actionRate(pose, f, phase, reaction);
  const { character } = f;
  const illidan = character === Character.demonHunter;
  const table = clips.characterClips(character);
  if (selectCommandGrabClip(pose, f)) return 1.0;
  if (inGrabContext(f)) return selectGrabClip(pose, f, world);
  if (f.ledge.state !== LedgeState.none) {
    const catching = illidan && f.ledge.state === LedgeState.hang && pose.motion.ledgeCatchRemaining > 0;
    const index = catching ? dh.DEMON_HUNTER_LEDGE_CATCH_INDEX : clips.clipFor(character, clips.ledgePose(f.ledge.state)).index;
    playIndex(pose, `ledge${f.ledge.state}${catching ? ":catch" : ""}`, index);
    if (catching) return clipRate(dh.DEMON_HUNTER_LEDGE_CATCH_SECONDS, LEDGE_CATCH_FRAMES);
    return illidan && f.ledge.state === LedgeState.hang ? 0.0 : rate;
  }
  if (f.shield.breakState !== ShieldBreak.none) {
    const key = `shieldbreak${f.shield.breakState}`;
    if (pose.animation !== key) {
      if (f.shield.breakState === ShieldBreak.land) selectFighterClipIndex(pose, clips.clipFor(character, "knockdown").index);
      else if (f.shield.breakState === ShieldBreak.stand) selectFighterClipIndex(pose, clips.clipFor(character, "getUp").index);
      else if (illidan) selectFighterClipIndex(pose, dh.DEMON_HUNTER_SHIELD_BREAK_INDEX);
      else if (table.dizzy !== undefined) selectFighterClipIndex(pose, table.dizzy.index);
      else selectFighterClipName(pose, "stand hit");
      pose.animation = key;
    }
    return rate;
  }

  const disabled = disabledPose(f, table);
  if (disabled !== undefined) {
    if (pose.animation !== disabled.key) {
      if (disabled.index !== undefined) selectFighterClipIndex(pose, disabled.index);
      else selectFighterClipName(pose, "stand hit");
      pose.animation = disabled.key;
    }
    return disabled.holdFrames > 0 ? clipRate(disabled.seconds, disabled.holdFrames) : rate;
  }
  if (posesDown(f)) {
    const key = `down${f.down.state}`;

    if (pose.animation !== key || (f.down.state === DownState.damage && hit)) {
      if (f.down.state !== DownState.wait) selectFighterClipIndex(pose, downClipIndex(f));
      else if (illidan) selectFighterClipIndex(pose, dh.DEMON_HUNTER_DOWN_WAIT_INDEX);
      pose.animation = key;
    }
    return rate;
  }

  if (f.surfaceRecovery.state === SurfaceContact.techWall) {
    const jumping = f.surfaceRecovery.wallJumpQueued;
    const wall = clips.clipFor(character, jumping ? "wallJump" : "wallTech");
    playIndex(pose, jumping ? "walljump" : "walltech", wall.index);
    return clipRate(wall.seconds, WALL_TECH_STARTUP_FRAMES + (jumping ? f.tuning.tech.wallJumpAnimationEndFrame : f.tuning.tech.wallAnimationEndFrame));
  }
  if (illidan && pose.motion.escapeRemaining > 0) {
    playIndex(pose, "grab-escape", dh.DEMON_HUNTER_GRAB_ESCAPE_INDEX);
    return clipRate(dh.DEMON_HUNTER_GRAB_ESCAPE_SECONDS, ESCAPE_FRAMES);
  }
  if (reaction !== DamagePose.none) {
    const contact = reaction !== DamagePose.shield && f.launch.hitstun > 0;
    const key = contact ? `damage-contact${f.visuals.hitHeight}:${f.visuals.hitStrength}` : `damage${reaction}`;

    if (hit || pose.animation !== key) {
      selectFighterClipIndex(pose, (contact ? contactDamageClip(f) : clips.clipFor(character, damageClipPose(reaction))).index);
      pose.animation = key;
    }
    return contact ? 0.0 : rate;
  }
  if (f.special.fall) {
    playIndex(pose, "specialfall", clips.clipFor(character, "fallSpecial").index);
    return rate;
  }
  if (f.special.parasol === ParasolState.open && f.attack.style === undefined) {
    playIndex(pose, "parasol", clips.parasolFloatClip(character).index);
    return rate;
  }
  if (isGroundDodging(f)) {
    playIndex(pose, "dodge", groundDodgeClip(f).index);
    return rate;
  }
  if (f.special.action !== SpecialAction.none && f.launch.hitstun === 0) {
    const peon = peonSpecialPose(f);
    if (peon !== undefined) {
      playIndex(pose, peon.key, peon.clip);
      pose.clipTime = peon.time;
      return 0.0;
    }
    playIndex(pose, `special${f.special.action}${playsFollowUpPose(f) ? "+" : ""}${wingBranch(f) ? f.special.form : ""}${refireKey(f)}`, fighterSpecialClip(f).index);
    return rate;
  }
  if (holdsSpecialEnd(pose, f)) return 0.0;
  const stateRate = illidan ? selectIllidanAction(pose, f, charging) : selectTableAction(pose, f, table, charging);
  if (stateRate !== undefined) return stateRate;
  if (pose.jumpAnimationRemaining > 0) {
    playIndex(pose, "jump", clips.clipFor(character, pose.doubleJumpAnimation ? "doubleJump" : "jump").index);
    return rate;
  }

  if (phase === AttackPhase.recovery && f.launch.hitlag === 0 && attackClip(f)?.until !== undefined) {
    if (table.idle === undefined) playName(pose, "jab-return", "stand ready");
    else playIndex(pose, "jab-return", table.idle.index);
    return 1.0;
  }
  if (phase !== AttackPhase.none || f.launch.hitstun !== 0 || f.launch.hitlag !== 0) {
    pose.animation = "";
    return rate;
  }
  if (illidan) {
    const { motion } = pose.motion;
    const gait = motion === IllidanLocomotion.walk ? groundLocomotionClip(character, motion) : undefined;
    if (gait !== undefined) {
      playLocomotionIndex(pose, motionKey(motion), gait.index, gait.entry);
      return groundLocomotionRate(f, motion, gait);
    }
    playIndex(pose, motionKey(motion), locomotionClipIndex(motion));
    return locomotionRate(f, motion);
  }
  const locomotionTable = koboldLocomotionClips(character, f.candle.state) ?? table;
  const groundClip = groundLocomotionClip(character, pose.motion.motion, locomotionTable);
  if (groundClip !== undefined) {
    playLocomotionIndex(pose, motionKey(pose.motion.motion), groundClip.index, groundClip.entry);
    return groundLocomotionRate(f, pose.motion.motion, groundClip);
  }
  const moving = tableLocomotion(locomotionTable, pose.motion.motion);
  if (moving !== undefined) {
    playIndex(pose, motionKey(pose.motion.motion), moving.index);
    return pose.motion.motion === IllidanLocomotion.run ? locomotionRate(f, pose.motion.motion) : tableLocomotionRate(moving, pose.motion.motion);
  }
  const walking = pose.motion.motion !== IllidanLocomotion.idle && f.motion.grounded && Math.abs(totalVelocityX(f)) > f32(0.1);

  const locomotion = locomotionTable[walking ? "walk" : "idle"];
  if (locomotion === undefined) playName(pose, walking ? "walk" : "stand", walking ? "walk" : "stand");
  else playLocomotionIndex(pose, walking ? "walk" : "stand", locomotion.index, walking ? locomotion.entry : 0.0);
  return walking ? min(f32(1.4), max(f32(0.2), f32(Math.abs(f.motion.vx) / f.tuning.physics.runSpeed))) : rate;
}


function selectGrabClip(pose: FighterPose, f: Readonly<Fighter>, world: Readonly<Roster>): number {
  const ownerSlot = f.grab.owner;
  const victim = ownerSlot !== undefined;
  const owner = ownerSlot === undefined ? f : fighterAt(world, ownerSlot);
  const { action, serial } = owner.grab;
  const illidanEscape = f.character === Character.demonHunter && action === GrabAction.escape;
  const carryLook = !victim && action === GrabAction.carry ? heroLook(f.character)?.carry : undefined;
  const carryWalking = carryLook !== undefined && f.motion.vx !== 0.0;
  const key = `grab${action}:${serial}${victim ? ":victim" : carryWalking ? ":carryWalk" : ":holder"}`;
  if (pose.animation !== key) {
    if (illidanEscape) selectFighterClipIndex(pose, dh.DEMON_HUNTER_GRAB_ESCAPE_INDEX);
    else if (carryLook !== undefined) selectFighterClipIndex(pose, clips.clipFor(f.character, carryWalking ? carryLook.walk : carryLook.stand).index);
    else if (action === GrabAction.escape) {

      const stance = clips.characterClips(f.character).idle;
      if (stance === undefined) selectFighterClipName(pose, "stand ready");
      else selectFighterClipIndex(pose, stance.index);
    } else selectFighterClipIndex(pose, grabClipIndex(f.character, action, victim));
    pose.animation = key;
  }
  if (illidanEscape) return clipRate(dh.DEMON_HUNTER_GRAB_ESCAPE_SECONDS, grabActionDuration(action, f.tuning.moves));
  if (carryLook !== undefined) return 1.0;
  const poses = clips.grabActionPoses(action);
  if (poses === undefined) {
    if (victim && f.character === Character.forsakenPaladin && (action === GrabAction.hold || action === GrabAction.none)) {
      pose.clipTime = min(pose.clipTime, f32(4 * FRAME_SECONDS));
      return owner.launch.hitlag > 0 ? 0.0 : pose.clipTime < f32(4 * FRAME_SECONDS) ? 1.0 : 0.0;
    }
    return 0.0;
  }
  const clip = clips.clipFor(f.character, victim ? poses.victim : poses.holder);
  const duration = grabActionDuration(action, owner.tuning.moves);
  if (clip.contact === undefined) return clipRate(clip.seconds, duration);
  const contact = grabContactFrame(action, owner.tuning.moves);
  const heldSlot = owner.grab.target;
  const frozen = owner.launch.hitlag > 0 || (heldSlot !== undefined && fighterAt(world, heldSlot).launch.hitlag > 0);


  if (owner.grab.frame < contact) {
    const rate = clipRate(clip.contact, contact);
    pose.clipTime = f32(f32(owner.grab.frame * FRAME_SECONDS) * rate);
    return frozen ? 0.0 : rate;
  }
  const rate = clipRate(f32(clip.seconds - clip.contact), duration - contact);
  pose.clipTime = f32(clip.contact + f32(f32((owner.grab.frame - contact) * FRAME_SECONDS) * rate));
  return frozen ? 0.0 : rate;
}





function selectTableAction(pose: FighterPose, f: Readonly<Fighter>, table: Readonly<HeroClipTable>, charging: boolean): number | undefined {
  const { dodge, jump, motion, landing, shield, attack } = f;
  if (dodge.airDodging && table.airDodge !== undefined) {
    playIndex(pose, "air-dodge", table.airDodge.index);
    return clipRate(table.airDodge.seconds, AIR_DODGE_ANIMATION_FRAMES);
  }
  if (jump.squat > 0 && table.jumpSquat !== undefined) {
    playIndex(pose, "jump-squat", table.jumpSquat.index);
    return clipRate(table.jumpSquat.seconds, authoredPhysics(f.character).jumpSquatFrames);
  }
  if (motion.grounded && landing.lag > 0 && table.landing !== undefined) {
    if (pose.animation !== "landing") {
      selectFighterClipIndex(pose, table.landing.index);
      pose.landingAnimationRate = clipRate(table.landing.seconds, landing.lag);
      pose.animation = "landing";
    }
    return pose.landingAnimationRate;
  }
  if ((shield.raised || shield.releaseLag > 0) && table.shield !== undefined) {
    playIndex(pose, "shield", table.shield.index);
    return 1.0;
  }
  const { style } = attack;


  const release = attackClip(f);
  const heldRelease = f.character === Character.shadowHunter && release?.aligned === true;
  if (charging && heldRelease) {
    playIndex(pose, "smash-charge", release.index);
    const chargeFrame = style === undefined ? attack.frame : max(attack.frame, smashChargeFrame(style, f.tuning.moves));
    pose.clipTime = f32(chargeFrame * FRAME_SECONDS);
    return 0.0;
  }
  if (charging) {
    const charge = table.smashCharge ?? table.idle;
    if (charge === undefined) playName(pose, "smash-charge", "stand ready");
    else playIndex(pose, "smash-charge", charge.index);
    return 0.0;
  }

  if (style !== undefined && release !== undefined && (pose.animation === "smash-charge" || pose.animation === "smash-release")) {
    if (heldRelease) {
      if (pose.animation === "smash-charge") {
        const held = pose.clipTime;
        selectFighterClipIndex(pose, release.index);
        pose.clipTime = held;
        pose.animation = "smash-release";
      }
      return attackRate(f, attackPhase(f));
    }
    if (pose.animation === "smash-charge") {
      selectFighterClipIndex(pose, release.index);
      pose.animation = "smash-release";
      if (f.character === Character.lichKing && style === AttackStyle.forwardSmash) {
        const startup = attackStartupFrames(style, f.tuning.moves);
        pose.clipTime = f32(strikeStart(f.character, style, release, startup) + f32(attackRate(f, AttackPhase.startup) * f32(attack.frame * FRAME_SECONDS)));
      }
    }
    if (f.character === Character.lichKing && style === AttackStyle.forwardSmash) return attackRate(f, attackPhase(f));
    return clipRate(release.seconds, attack.duration - attackStartupFrames(style, f.tuning.moves));
  }
  return undefined;
}


function tableLocomotion(table: Readonly<HeroClipTable>, motion: IllidanLocomotion): HeroClip | undefined {
  switch (motion) {
    case IllidanLocomotion.dash: return table.dash;
    case IllidanLocomotion.run: return table.run;
    case IllidanLocomotion.turn: return table.turn;
    case IllidanLocomotion.stop: return table.stop;
    case IllidanLocomotion.crouch: return table.crouch;
    case IllidanLocomotion.fall:
    case IllidanLocomotion.fastFall: return table.fall;
    default: return undefined;
  }
}


function selectIllidanAction(pose: FighterPose, f: Readonly<Fighter>, charging: boolean): number | undefined {
  const { dodge, jump, motion, landing, shield, attack } = f;
  if (dodge.airDodging) {
    playIndex(pose, "air-dodge", dh.DEMON_HUNTER_AIR_DODGE_INDEX);
    return clipRate(dh.DEMON_HUNTER_AIR_DODGE_SECONDS, AIR_DODGE_ANIMATION_FRAMES);
  }
  if (jump.squat > 0) {
    playIndex(pose, "jump-squat", dh.DEMON_HUNTER_JUMP_SQUAT_INDEX);
    return clipRate(dh.DEMON_HUNTER_JUMP_SQUAT_SECONDS, authoredPhysics(f.character).jumpSquatFrames);
  }
  if (motion.grounded && landing.lag > 0) {
    if (pose.animation !== "landing") {
      const special = pose.animation === "specialfall" || pose.animation === "air-dodge";
      selectFighterClipIndex(pose, special ? dh.DEMON_HUNTER_LAND_SPECIAL_INDEX : dh.DEMON_HUNTER_LAND_INDEX);
      pose.landingAnimationRate = clipRate(special ? dh.DEMON_HUNTER_LAND_SPECIAL_SECONDS : dh.DEMON_HUNTER_LAND_SECONDS, landing.lag);
      pose.animation = "landing";
    }
    return pose.landingAnimationRate;
  }
  if (shield.raised) {
    const raising = shield.heldFrames <= SHIELD_RAISE_FRAMES;
    playIndex(pose, raising ? "shield-raise" : "shield-hold", raising ? dh.DEMON_HUNTER_SHIELD_RAISE_INDEX : dh.DEMON_HUNTER_SHIELD_HOLD_INDEX);
    return raising ? clipRate(dh.DEMON_HUNTER_SHIELD_RAISE_SECONDS, SHIELD_RAISE_FRAMES) : 0.0;
  }
  if (shield.releaseLag > 0) {
    playIndex(pose, "shield-release", dh.DEMON_HUNTER_SHIELD_RELEASE_INDEX);
    return clipRate(dh.DEMON_HUNTER_SHIELD_RELEASE_SECONDS, SHIELD_RELEASE_LAG_FRAMES);
  }
  const { style } = attack;
  if (charging) {
    playIndex(pose, "smash-charge", clips.illidanSmashClips(style).charge.index);
    return 0.0;
  }

  if (style !== undefined && (pose.animation === "smash-charge" || pose.animation === "smash-release")) {
    const release = clips.illidanSmashClips(style).release;
    if (pose.animation === "smash-charge") {
      selectFighterClipIndex(pose, release.index);
      pose.animation = "smash-release";
    }
    return clipRate(release.seconds, attack.duration - attackStartupFrames(style, f.tuning.moves));
  }
  if (pose.motion.respawnRemaining > 0) {
    playIndex(pose, "respawn", dh.DEMON_HUNTER_RESPAWN_INDEX);
    return clipRate(dh.DEMON_HUNTER_RESPAWN_SECONDS, RESPAWN_FRAMES);
  }
  if (pose.motion.ledgeJump && pose.jumpAnimationRemaining > 0) {
    playIndex(pose, "ledge-jump", dh.DEMON_HUNTER_LEDGE_JUMP_INDEX);
    return clipRate(dh.DEMON_HUNTER_LEDGE_JUMP_SECONDS, JUMP_CLIP_FRAMES);
  }
  return undefined;
}


function attackClip(f: Readonly<Fighter>): HeroClip | undefined {
  const { style } = f.attack;
  const own = clips.ownAttackClip(f.character, style);
  const shared = clips.attackPose(style);
  return own ?? (shared === undefined ? undefined : clips.clipFor(f.character, shared));
}


export function selectScriptedAttackClip(pose: FighterPose, f: Readonly<Fighter>): void {
  selectAttackClip(pose, f);
  pose.clipTime = f32(pose.clipTime - f32(pose.rate * FRAME_SECONDS));
}


function selectAttackClip(pose: FighterPose, f: Readonly<Fighter>): void {
  const { style } = f.attack;
  if (f.character === Character.demonHunter) pose.animation = "";
  const clip = attackClip(f);
  if (clip === undefined) {
    selectFighterClipName(pose, "attack");
    return;
  }
  selectFighterClipIndex(pose, clip.index);

  if (style !== undefined) pose.clipTime = strikeStart(f.character, style, clip, attackStartupFrames(style, f.tuning.moves));
}


function actionRate(pose: Readonly<FighterPose>, f: Readonly<Fighter>, phase: AttackPhase, reaction: DamagePose): number {
  const { character } = f;
  if (f.ledge.state === LedgeState.climb) return clipRate(clips.clipFor(character, "ledgeClimb").seconds, LEDGE_CLIMB_FRAMES);
  if (f.ledge.state === LedgeState.roll) return clipRate(clips.clipFor(character, "ledgeRoll").seconds, LEDGE_ROLL_FRAMES);
  if (f.ledge.state === LedgeState.attack) return clipRate(clips.clipFor(character, "ledgeAttack").seconds, LEDGE_ATTACK_FRAMES);
  if (f.shield.breakState === ShieldBreak.land) return clipRate(clips.clipFor(character, "knockdown").seconds, SHIELD_BREAK_LAND_FRAMES);
  if (f.shield.breakState === ShieldBreak.stand) return clipRate(clips.clipFor(character, "getUp").seconds, SHIELD_BREAK_STAND_FRAMES);
  if (posesDown(f)) return downRate(f);
  if (reaction !== DamagePose.none) return clipRate(clips.clipFor(character, damageClipPose(reaction)).seconds, REACTION_CLIP_FRAMES);
  if (f.special.fall) return 0.0;
  if (isGroundDodging(f)) return clipRate(groundDodgeClip(f).seconds, f.dodge.groundDirection === 0 ? SPOT_DODGE_FRAMES : GROUND_ROLL_FRAMES);
  if (f.special.action !== SpecialAction.none && f.launch.hitstun === 0) return specialRate(f);
  if (pose.jumpAnimationRemaining > 0) {
    return pose.doubleJumpAnimation
      ? clipRate(clips.clipFor(character, "doubleJump").seconds, DOUBLE_JUMP_CLIP_FRAMES)
      : clipRate(clips.clipFor(character, "jump").seconds, JUMP_CLIP_FRAMES);
  }
  return attackRate(f, phase);
}


const EARLIEST_STRIKE = f32(0.034);

const FASTEST_SWING = 4.0;
const SLOWEST_SWING = f32(0.35);

const FOLLOW_THROUGH = f32(0.4);


const strikeSkip = (strike: number, startup: number): number => max(0.0, f32(strike - f32(FASTEST_SWING * f32(startup * FRAME_SECONDS))));


export function strikeStart(character: number, style: number, clip: Readonly<HeroClip>, startup: number): number {
  const moment = HERO_STRIKE_MOMENTS[character]?.[style];
  return moment === undefined || clip.aligned === true || moment.clip !== clip.index || moment.seconds < EARLIEST_STRIKE || startup <= 0 ? 0.0 : strikeSkip(moment.seconds, startup);
}








export function strikeAlignedRate(character: number, style: number, clip: Readonly<HeroClip>, startup: number, active: number, duration: number, phase: AttackPhase): number | undefined {
  const moment = HERO_STRIKE_MOMENTS[character]?.[style];
  const recovery = duration - startup - active;
  if (moment === undefined || clip.aligned === true || moment.clip !== clip.index || moment.seconds < EARLIEST_STRIKE || startup <= 0 || active <= 0 || recovery <= 0) return undefined;
  const bounded = (seconds: number, frames: number): number => min(FASTEST_SWING, max(SLOWEST_SWING, f32(seconds / f32(frames * FRAME_SECONDS))));
  const skip = strikeSkip(moment.seconds, startup);
  const windUp = bounded(f32(moment.seconds - skip), startup);
  if (phase === AttackPhase.startup) return windUp;
  const atActive = f32(skip + f32(windUp * f32(startup * FRAME_SECONDS)));
  const strike = atActive < moment.seconds ? bounded(f32(moment.seconds - atActive), active) : bounded(FOLLOW_THROUGH, active + recovery);
  if (phase === AttackPhase.active) return strike;
  const atRecovery = f32(atActive + f32(strike * f32(active * FRAME_SECONDS)));
  const end = max(clip.seconds, min(moment.end, f32(moment.seconds + FOLLOW_THROUGH)));
  return min(FASTEST_SWING, max(0.0, f32(f32(end - atRecovery) / f32(recovery * FRAME_SECONDS))));
}

function attackRate(f: Readonly<Fighter>, phase: AttackPhase): number {
  if (phase === AttackPhase.none) return 1.0;
  const { style, duration } = f.attack;
  const aligned = (clip: Readonly<HeroClip>): number => clip.until !== undefined && style !== undefined
    ? phase === AttackPhase.startup ? clipRate(clip.until, max(1, attackStartupFrames(style, f.tuning.moves))) : phase === AttackPhase.active ? 0.0 : 1.0
    : (style === undefined ? undefined : strikeAlignedRate(f.character, style, clip, attackStartupFrames(style, f.tuning.moves), characterAttackActiveFrames(f.character, style, f.tuning.moves), duration, phase))
    ?? clipRate(clip.seconds, duration);
  const own = clips.ownAttackClip(f.character, style);
  if (own !== undefined) return aligned(own);

  if (style === AttackStyle.ledgeAttack) return clipRate(clips.clipFor(f.character, "getUpAttack").seconds, LEDGE_ATTACK_FRAMES);
  const shared = clips.attackPose(style);
  return shared === undefined ? 1.0 : aligned(clips.clipFor(f.character, shared));
}

function downClipIndex(f: Readonly<Fighter>): number {
  const { state, direction } = f.down;
  const forward = direction === f.facing;
  if (f.character === Character.demonHunter) {
    if (state === DownState.tech) return dh.DEMON_HUNTER_TECH_NEUTRAL_INDEX;
    if (state === DownState.techRoll) return forward ? dh.DEMON_HUNTER_TECH_FORWARD_INDEX : dh.DEMON_HUNTER_TECH_BACK_INDEX;
    if (state === DownState.roll) return forward ? dh.DEMON_HUNTER_GET_UP_ROLL_FORWARD_INDEX : dh.DEMON_HUNTER_GET_UP_ROLL_BACK_INDEX;
  }
  switch (state) {
    case DownState.damage: return clips.clipFor(f.character, "downDamage").index;
    case DownState.bound:
    case DownState.wait: return clips.clipFor(f.character, "knockdown").index;
    case DownState.stand: return clips.clipFor(f.character, "getUp").index;
    case DownState.tech: return clips.clipFor(f.character, "tech").index;
    case DownState.techRoll: return clips.clipFor(f.character, forward ? "techForward" : "techBackward").index;
    default: return clips.clipFor(f.character, forward ? "getUpRollForward" : "getUpRollBackward").index;
  }
}

function downRate(f: Readonly<Fighter>): number {
  const { state, direction } = f.down;
  const forward = direction === f.facing;
  if (f.character === Character.demonHunter) {
    if (state === DownState.tech) return clipRate(dh.DEMON_HUNTER_TECH_NEUTRAL_SECONDS, TECH_IN_PLACE_FRAMES);
    if (state === DownState.techRoll) return clipRate(forward ? dh.DEMON_HUNTER_TECH_FORWARD_SECONDS : dh.DEMON_HUNTER_TECH_BACK_SECONDS, TECH_ROLL_FRAMES);
    if (state === DownState.roll) return clipRate(forward ? dh.DEMON_HUNTER_GET_UP_ROLL_FORWARD_SECONDS : dh.DEMON_HUNTER_GET_UP_ROLL_BACK_SECONDS, DOWN_ROLL_FRAMES);
  }
  switch (state) {
    case DownState.damage: return clipRate(clips.clipFor(f.character, "downDamage").seconds, DOWN_DAMAGE_FRAMES);
    case DownState.wait: return 0.0;
    case DownState.bound: return clipRate(clips.clipFor(f.character, "knockdown").seconds, DOWN_BOUND_FRAMES);
    case DownState.stand: return clipRate(clips.clipFor(f.character, "getUp").seconds, DOWN_STAND_FRAMES);
    case DownState.tech: return clipRate(clips.clipFor(f.character, "tech").seconds, TECH_IN_PLACE_FRAMES);
    default: {
      const roll = clips.clipFor(f.character, state === DownState.techRoll
        ? forward ? "techForward" : "techBackward"
        : forward ? "getUpRollForward" : "getUpRollBackward");
      return clipRate(roll.seconds, state === DownState.techRoll ? TECH_ROLL_FRAMES : DOWN_ROLL_FRAMES);
    }
  }
}

function groundDodgeClip(f: Readonly<Fighter>): HeroClip {
  if (f.dodge.groundDirection === 0) return clips.clipFor(f.character, "spotDodge");
  return clips.clipFor(f.character, isForwardGroundRoll(f) ? "rollForward" : "rollBackward");
}


const wingBranch = (f: Readonly<Fighter>): boolean => f.special.action === SpecialAction.demonHunterWingAscent && f.special.form !== 0;

function fighterSpecialClip(f: Readonly<Fighter>): HeroClip {
  if (wingBranch(f)) return clips.illidanWingClip(f.special.form);
  if (f.character === Character.chen && f.special.action === SpecialAction.heroDown && f.special.form >= 2 * FOLLOW_UP_FORM) {
    return clips.clipFor(f.character, f.motion.grounded ? "sideSpecialFollowUp" : "sideSpecialFollowUpAir");
  }
  const aerialShot = f.special.duration === RIFLEMAN_BLASTER_AIR_FRAMES;
  return refiredClip(f, clips.specialClip(f.character, f.special.action, f.motion.grounded, aerialShot, playsFollowUpPose(f), f.special.form >= FOLLOW_UP_FORM ? idiv(f.special.form, FOLLOW_UP_FORM) - 1 : 0));
}

function damageClipPose(reaction: DamagePose): HeroPose {
  switch (reaction) {
    case DamagePose.ground: return "damageGround";
    case DamagePose.tumble: return "damageTumble";
    case DamagePose.shield: return "damageShield";
    default: return "damageAir";
  }
}

function grabClipIndex(character: Character, action: GrabAction, victim: boolean): number {
  const poses = clips.grabActionPoses(action);
  if (poses !== undefined) return clips.clipFor(character, victim ? poses.victim : poses.holder).index;
  return clips.clipFor(character, victim ? "grabbed" : "grabHold").index;
}

function locomotionClipIndex(motion: IllidanLocomotion): number {
  switch (motion) {
    case IllidanLocomotion.run: return dh.DEMON_HUNTER_RUN_FORWARD_INDEX;
    case IllidanLocomotion.dash: return dh.DEMON_HUNTER_INITIAL_DASH_BURST_INDEX;
    case IllidanLocomotion.turn: return dh.DEMON_HUNTER_TURNAROUND_INDEX;
    case IllidanLocomotion.stop: return dh.DEMON_HUNTER_STOP_INDEX;
    case IllidanLocomotion.crouch: return dh.DEMON_HUNTER_CROUCH_INDEX;
    case IllidanLocomotion.fastFall: return dh.DEMON_HUNTER_FAST_FALL_INDEX;
    case IllidanLocomotion.fall: return dh.DEMON_HUNTER_FALL_INDEX;
    default: return dh.DEMON_HUNTER_COMBAT_IDLE_INDEX;
  }
}


function tableLocomotionRate(clip: HeroClip, motion: IllidanLocomotion): number {
  if (motion === IllidanLocomotion.dash) return clipRate(clip.seconds, INITIAL_DASH_FRAMES);
  if (motion === IllidanLocomotion.turn || motion === IllidanLocomotion.stop) return clipRate(clip.seconds, TRANSITION_FRAMES);
  if (motion === IllidanLocomotion.crouch) return clipRate(clip.seconds, CROUCH_CLIP_FRAMES);
  return 0.0;
}


function locomotionRate(f: Readonly<Fighter>, motion: IllidanLocomotion): number {
  switch (motion) {
    case IllidanLocomotion.dash: return clipRate(dh.DEMON_HUNTER_INITIAL_DASH_BURST_SECONDS, INITIAL_DASH_FRAMES);
    case IllidanLocomotion.turn: return clipRate(dh.DEMON_HUNTER_TURNAROUND_SECONDS, TRANSITION_FRAMES);
    case IllidanLocomotion.stop: return clipRate(dh.DEMON_HUNTER_STOP_SECONDS, TRANSITION_FRAMES);
    case IllidanLocomotion.crouch: return clipRate(dh.DEMON_HUNTER_CROUCH_SECONDS, CROUCH_CLIP_FRAMES);
    case IllidanLocomotion.fall:
    case IllidanLocomotion.fastFall: return 0.0;
    case IllidanLocomotion.walk:
    case IllidanLocomotion.run: return groundLocomotionRate(f, motion);
    default: return 1.0;
  }
}






function specialRate(f: Readonly<Fighter>): number {
  const clip = fighterSpecialClip(f);
  const even = clipRate(clip.seconds, refireClipFrames(f));
  const { action, frame } = f.special;
  const move = playsFollowUpPose(f) ? undefined : runningHeroSpecial(f);
  if (move === undefined) return even;
  const { active } = heroCueWindows(move, 1);
  const phase = frame < active.first ? AttackPhase.startup : frame <= active.last ? AttackPhase.active : AttackPhase.recovery;
  const slot = action - SpecialAction.heroNeutral;
  return strikeAlignedRate(f.character, SPECIAL_KEY + slot, clip, active.first - 1, active.last - active.first + 1, f.special.duration, phase) ?? even;
}
