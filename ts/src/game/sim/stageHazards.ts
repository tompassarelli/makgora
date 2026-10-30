




import { floorDiv, floorMod } from "wisp/src/sim/intMath";
import { f32 } from "wisp/src/sim/f32";
import { PARTICIPANT_SLOTS } from "../input/participants";
import { DownState, LedgeState } from "./codes";
import { inGrabContext } from "./conditions";
import type { Fighter } from "./fighter";
import { setWorldMotionValue } from "./motion";
import { type Controls, type Roster, fighterAt, isActive } from "./roster";
import { CANNON_TEST_STAGE, TOMB_OF_SARGERAS_STAGE, WIND_TEST_STAGE, mainDeckLeft, mainDeckRight, mainDeckZ, stageAtRest } from "./stage";
import { stageBounds } from "./stageBounds";
import { cancelAttack, cancelSpecialState, clearDownState, clearGrabLinks, interruptJumpOrDodge } from "./transitions";
import { melee } from "./tuning";
import { mutableCannon } from "./fighterRest";




export const WindPhase = { calm: 0, cue: 1, blowing: 2 } as const;
export type WindPhase = (typeof WindPhase)[keyof typeof WindPhase];

/** GrOp.dat yakumono_param: Whispy's shortest wait between gusts. */
export const WIND_CALM_FRAMES = 600;
/** Whispy's blow animation runs this long before the wind starts, its sound on the last of them. */
export const WIND_CUE_FRAMES = 45;

export const WIND_BLOW_FRAMES = 274;
export const WIND_CYCLE_FRAMES = WIND_CALM_FRAMES + WIND_CUE_FRAMES + WIND_BLOW_FRAMES;
/** GrOp.dat: Melee units a gust moves a fighter each frame. */
export const WIND_SPEED = melee(0.20000000298023224);
// Whispy gust bounds use GrOp.dat and Dream Land ledges at ±77.2713.




const WIND_INNER_EDGE_RIGHT = melee(17.0);
const WIND_INNER_EDGE_LEFT = melee(18.0);
const WIND_OUTER_INSET_RIGHT = melee(1.2713000774383545);
const WIND_OUTER_INSET_LEFT = melee(3.2713000774383545);
const WIND_BOTTOM = melee(-10.0);
const WIND_TOP = melee(40.0);

const windCycle = (frame: number) => floorMod(frame - 1, WIND_CYCLE_FRAMES);


export function windPhase(frame: number): WindPhase {
  const cycle = windCycle(frame);
  if (cycle < WIND_CALM_FRAMES) return WindPhase.calm;
  return cycle < WIND_CALM_FRAMES + WIND_CUE_FRAMES ? WindPhase.cue : WindPhase.blowing;
}


export function windDirection(frame: number): -1 | 1 {
  return floorMod(floorDiv(frame - 1, WIND_CYCLE_FRAMES), 2) === 0 ? 1 : -1;
}


export function framesUntilWind(frame: number): number {
  const cycle = windCycle(frame);
  return cycle >= WIND_CALM_FRAMES + WIND_CUE_FRAMES ? 0 : WIND_CALM_FRAMES + WIND_CUE_FRAMES - cycle;
}

const stageCenter = (stage: number) => f32(f32(mainDeckLeft(stage) + mainDeckRight(stage)) / 2);


export function windLeft(stage: number, direction: -1 | 1): number {
  return direction > 0 ? f32(stageCenter(stage) - WIND_INNER_EDGE_RIGHT) : f32(mainDeckLeft(stage) + WIND_OUTER_INSET_LEFT);
}

export function windRight(stage: number, direction: -1 | 1): number {
  return direction > 0 ? f32(mainDeckRight(stage) - WIND_OUTER_INSET_RIGHT) : f32(stageCenter(stage) + WIND_INNER_EDGE_LEFT);
}

const windBottom = (stage: number): number => f32(mainDeckZ(stage) + WIND_BOTTOM);
const windTop = (stage: number): number => f32(mainDeckZ(stage) + WIND_TOP);

export const hasWind = (stage: number): boolean => stage === WIND_TEST_STAGE;


export const windOn = (stage: number, frame: number): boolean => hasWind(stage) && !stageAtRest(frame);


export function windPush(stage: number, frame: number, x: number, z: number): number {
  if (!windOn(stage, frame) || windPhase(frame) !== WindPhase.blowing) return 0.0;
  const direction = windDirection(frame);
  if (!(x > windLeft(stage, direction) && x < windRight(stage, direction) && z > windBottom(stage) && z < windTop(stage))) return 0.0;
  return direction > 0 ? WIND_SPEED : -WIND_SPEED;
}




const TidePhase = { flood: 0, slackToEbb: 1, ebb: 2, slackToFlood: 3 } as const;
type TidePhase = (typeof TidePhase)[keyof typeof TidePhase];


export const TIDE_FLOW_FRAMES = 540;
export const TIDE_SLACK_FRAMES = 60;

const TIDE_CYCLE_FRAMES = 2 * (TIDE_FLOW_FRAMES + TIDE_SLACK_FRAMES);

export const TIDE_SPEED = melee(0.800000011920929);

export const SEA_SURFACE_Z = -360.0;

export const hasTide = (stage: number): boolean => stage === TOMB_OF_SARGERAS_STAGE;

const tideCycle = (frame: number) => floorMod(frame - 1, TIDE_CYCLE_FRAMES);


function tidePhase(frame: number): TidePhase {
  const cycle = tideCycle(frame);
  if (cycle < TIDE_FLOW_FRAMES) return TidePhase.flood;
  if (cycle < TIDE_FLOW_FRAMES + TIDE_SLACK_FRAMES) return TidePhase.slackToEbb;
  return cycle < TIDE_CYCLE_FRAMES - TIDE_SLACK_FRAMES ? TidePhase.ebb : TidePhase.slackToFlood;
}


export function tideDirection(frame: number): -1 | 0 | 1 {
  const phase = tidePhase(frame);
  return phase === TidePhase.flood ? 1 : phase === TidePhase.ebb ? -1 : 0;
}


export function tideNextDirection(frame: number): -1 | 1 {
  const phase = tidePhase(frame);
  return phase === TidePhase.flood || phase === TidePhase.slackToFlood ? 1 : -1;
}


export function framesUntilTideTurns(frame: number): number {
  const phase = tidePhase(frame);
  if (phase === TidePhase.flood || phase === TidePhase.ebb) return 0;
  const cycle = tideCycle(frame);
  return (phase === TidePhase.slackToEbb ? TIDE_FLOW_FRAMES + TIDE_SLACK_FRAMES : TIDE_CYCLE_FRAMES) - cycle;
}


const seaLeft = (stage: number): number => stageBounds(stage).blast.left;
export const seaRight = (stage: number): number => stageBounds(stage).blast.right;


export function inSea(stage: number, x: number, z: number): boolean {
  return hasTide(stage) && z <= SEA_SURFACE_Z && x >= seaLeft(stage) && x <= seaRight(stage);
}


export function tidePush(stage: number, frame: number, x: number, z: number): number {
  if (!inSea(stage, x, z)) return 0.0;
  const direction = tideDirection(frame);
  return direction === 0 ? 0.0 : direction > 0 ? TIDE_SPEED : -TIDE_SPEED;
}




const CANNON_SWING_HALF_WIDTH = 480.0;
const CANNON_SWING_SPEED = 5.0;

const CANNON_SWING_FRAMES = 192;

/** Where a held fighter sits: below Blackrock's underside (its lowest edge is z -300) with the whole barrel clear of it. */
export const CANNON_Z = -500.0;

/** The barrel only rocks as it travels; the shot ignores it. */
const CANNON_ROCK = f32(0.12);
/** A fighter whose position comes this close to the barrel's centre is caught. */
const CANNON_CATCH_RADIUS = 120.0;
/** The barrel fires by itself after this long, so nobody waits in it. */
export const CANNON_HOLD_FRAMES = 150;
/** The shot leaves this many frames after it begins, its warning to the held fighter. */
export const CANNON_SHOT_FRAMES = 10;
/** The rise lasts this many frames, flames on the fighter throughout. */
export const CANNON_RISE_FRAMES = 45;
/** The fighter peaks this far above the stage deck, about a full hop. */
export const CANNON_PEAK_HEIGHT = 240.0;
/** Frames of tumble after the flames end, so the fighter acts a beat later. */
export const CANNON_BEAT_FRAMES = 8;
/** Frames after a shot before a barrel catches the fighter again. */
export const CANNON_RECATCH_FRAMES = 30;


export function cannonX(frame: number): number {
  const step = floorMod(frame - 1, 2 * CANNON_SWING_FRAMES);
  const travelled = step < CANNON_SWING_FRAMES ? step : 2 * CANNON_SWING_FRAMES - step;
  return f32(-CANNON_SWING_HALF_WIDTH + f32(travelled * CANNON_SWING_SPEED));
}


export function cannonRock(frame: number): number {
  return f32(f32(-cannonX(frame) / CANNON_SWING_HALF_WIDTH) * CANNON_ROCK);
}

export const hasCannon = (stage: number): boolean => stage === CANNON_TEST_STAGE;


export const cannonOn = (stage: number, frame: number): boolean => hasCannon(stage) && !stageAtRest(frame);

export const inStageCannon = (f: Readonly<Fighter>): boolean => f.cannon.held !== undefined;


export const cannonRising = (f: Readonly<Fighter>): boolean => f.cannon.firing !== undefined && f.cannon.firing >= CANNON_SHOT_FRAMES;


export function cannonRiseZ(stage: number, risen: number): number {
  const left = f32(1.0 - f32(risen / CANNON_RISE_FRAMES));
  return f32(CANNON_Z + f32(f32(mainDeckZ(stage) + CANNON_PEAK_HEIGHT - CANNON_Z) * f32(1.0 - f32(left * left))));
}


export function endCannonPass(f: Fighter, stage: number): void {
  if (f.cannon.passing && (f.motion.grounded || f.motion.z > mainDeckZ(stage))) mutableCannon(f).passing = false;
}

function holdAt(f: Fighter, x: number, z: number): void {
  const { motion, launch } = f;
  motion.x = x;
  motion.z = z;
  setWorldMotionValue(motion.meleeX, motion.x);
  setWorldMotionValue(motion.meleeZ, motion.z);
  motion.vx = 0.0;
  motion.vz = 0.0;
  setWorldMotionValue(motion.meleeVelocityZ, 0.0);
  launch.knockbackX = 0.0;
  launch.knockbackZ = 0.0;
  launch.groundKnockbackX = 0.0;
  f.shield.pushbackX = 0.0;
  f.shield.recoilX = 0.0;
  f.shield.recoilZ = 0.0;
}

function catchFighter(world: Roster, slot: number, frame: number): void {
  const f = fighterAt(world, slot);
  clearGrabLinks(world, slot);
  interruptJumpOrDodge(f);
  clearDownState(f);
  cancelAttack(f);
  cancelSpecialState(f);
  const { motion, launch } = f;
  motion.grounded = false;
  motion.surface = undefined;
  motion.fastFalling = false;
  motion.crouching = false;
  launch.hitstun = 0;
  launch.throwHitstun = false;
  launch.diPending = false;
  launch.diLaunchSpeed = 0.0;
  f.shield.raised = false;
  const cannon = mutableCannon(f);
  cannon.held = 0;
  cannon.firing = undefined;
  cannon.passing = false;
  holdAt(f, cannonX(frame), CANNON_Z);
}


function beginRise(f: Fighter): void {
  mutableCannon(f).passing = true;
  f.down.state = DownState.tumble;
  f.down.frame = 0;
  f.down.direction = 0;
  f.down.faceUp = true;
  f.launch.damageLevel = 3;
}

function release(f: Fighter, stage: number): void {
  const cannon = mutableCannon(f);
  cannon.held = undefined;
  cannon.firing = undefined;
  cannon.cooldown = CANNON_RECATCH_FRAMES;
  cannon.passing = f.motion.z <= mainDeckZ(stage);
  clearDownState(f);
  f.launch.hitstun = CANNON_BEAT_FRAMES;
}

function canBeCaught(f: Readonly<Fighter>, frame: number): boolean {
  if (f.status.out || f.cannon.cooldown > 0 || inGrabContext(f) || f.ledge.state !== LedgeState.none) return false;
  const dx = f32(f.motion.x - cannonX(frame));
  const dz = f32(f.motion.z - CANNON_Z);
  return f32(f32(dx * dx) + f32(dz * dz)) < f32(CANNON_CATCH_RADIUS * CANNON_CATCH_RADIUS);
}







export function advanceStageCannon(world: Roster, stage: number, frame: number, inputs: readonly Readonly<Controls>[]): void {
  if (!cannonOn(stage, frame)) return;
  let occupied = false;
  for (const slot of PARTICIPANT_SLOTS) {
    if (!isActive(world, slot)) continue;
    const f = fighterAt(world, slot);
    const held = f.cannon.held;
    if (held === undefined) {
      if (f.cannon.cooldown > 0 && f.launch.hitlag <= 0) mutableCannon(f).cooldown--;
      continue;
    }
    const cannon = mutableCannon(f);
    occupied = true;
    cannon.held = held + 1;
    const input = inputs[slot];
    if (cannon.firing === undefined && (cannon.held >= CANNON_HOLD_FRAMES || input?.attackPressed === true || input?.specialPressed === true)) cannon.firing = 0;
    if (cannon.firing === undefined) {
      holdAt(f, cannonX(frame), CANNON_Z);
      continue;
    }
    cannon.firing++;
    if (cannon.firing < CANNON_SHOT_FRAMES) {
      holdAt(f, cannonX(frame), CANNON_Z);
      continue;
    }
    if (cannon.firing === CANNON_SHOT_FRAMES) beginRise(f);
    const risen = cannon.firing - CANNON_SHOT_FRAMES;
    holdAt(f, f.motion.x, cannonRiseZ(stage, risen));
    if (risen >= CANNON_RISE_FRAMES) release(f, stage);
  }
  if (occupied) return;
  for (const slot of PARTICIPANT_SLOTS) {
    if (!isActive(world, slot) || !canBeCaught(fighterAt(world, slot), frame)) continue;
    catchFighter(world, slot, frame);
    return;
  }
}
