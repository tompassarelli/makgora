import { min } from "../core/numbers";
import { addFloat32, subtractFloat32 } from "wisp/src/sim/binary32";
import { DownState, SpecialAction } from "./codes";
import { isAerialAttack } from "./moves";
import { finishLanding } from "./down";
import { type Fighter, PLATFORM_DROP_INPUT_WINDOW } from "./fighter";
import { setWorldMotionValue, totalVelocityZ } from "./motion";
import type { Controls } from "./roster";
import { surfaceCount, surfaceLeft, surfacePass, surfaceRight, surfaceZ } from "./stage";
import { stickX, stickZ } from "./stick";
import { bodyTop } from "./surfaces";
import { clearDash } from "./groundMovement";
import { aerialJumps } from "./itemBuffs";
import { melee } from "./tuning";
import { CROUCH_STICK_THRESHOLD, DASH_FLICK_SAMPLES, STICK_DEADZONE } from "./stickZones";

export function trackPlatformInput(f: Fighter, input: Readonly<Controls>): void {
  const p = f.platform;
  const down = stickZ(input) <= -STICK_DEADZONE;
  p.downAge = down ? (p.downHeld ? min(DASH_FLICK_SAMPLES, p.downAge + 1) : 0) : DASH_FLICK_SAMPLES;
  p.downHeld = down;
  if (!down) p.dropConsumed = false;
}

function consumeDown(f: Fighter): void {
  f.platform.downAge = DASH_FLICK_SAMPLES;
  f.platform.downHeld = true;
  f.platform.dropConsumed = true;
  f.motion.fastFallInputAge = PLATFORM_DROP_INPUT_WINDOW;
  f.motion.fastFallDownHeld = true;
  f.motion.fastFalling = false;
}

function ascentDeck(f: Readonly<Fighter>, stage: number, matchFrame: number): number | undefined {
  const { motion } = f;
  const top = addFloat32(motion.z, melee(bodyTop(f.character)));
  let found: number | undefined;
  let foundZ = 0.0;
  for (let deck = 0; deck < surfaceCount(stage); deck++) {
    if (!surfacePass(stage, deck)) continue;
    const z = surfaceZ(stage, deck, matchFrame);
    if (!(motion.z < z && top >= z)) continue;
    if (motion.x < surfaceLeft(stage, deck, matchFrame) || motion.x > surfaceRight(stage, deck, matchFrame)) continue;
    if (found === undefined || z < foundZ) { found = deck; foundZ = z; }
  }
  return found;
}

export function mountPlatform(f: Fighter, stage: number, matchFrame: number, input: Readonly<Controls>): boolean {
  if (f.motion.grounded || f.launch.hitstun > 0 || f.launch.hitlag > 0 || totalVelocityZ(f) <= 0
    || stickZ(input) >= -CROUCH_STICK_THRESHOLD || Math.abs(stickX(input)) > STICK_DEADZONE || isAerialAttack(f.attack.style) || f.dodge.airDodging
    || f.special.action !== SpecialAction.none || f.special.fall) return false;
  const deck = ascentDeck(f, stage, matchFrame);
  if (deck === undefined) return false;
  finishLanding(f, stage, matchFrame, input, deck, false);
  f.landing.lag = 0;
  f.motion.crouching = input.direction === 0;
  consumeDown(f);
  return true;
}

function dropPlatform(f: Fighter, stage: number, matchFrame: number, deck: number): void {
  f.jump.remaining = min(f.jump.remaining, aerialJumps(f));
  f.motion.grounded = false;
  f.motion.surface = undefined;
  f.motion.crouching = false;
  f.motion.z = subtractFloat32(surfaceZ(stage, deck, matchFrame), 1.0);
  setWorldMotionValue(f.motion.meleeZ, f.motion.z);
  f.motion.vz = 0.0;
  setWorldMotionValue(f.motion.meleeVelocityZ, 0.0);
  f.landing.lag = 0;
  clearDash(f);
  consumeDown(f);
}

function intentOpen(f: Readonly<Fighter>, stage: number, deck: number): boolean {
  return surfacePass(stage, deck) && f.launch.hitstun <= 0 && f.launch.hitlag <= 0
    && f.down.state === DownState.none && !f.dodge.airDodging;
}

export function dropFromPlatform(f: Fighter, stage: number, matchFrame: number, input: Readonly<Controls>): boolean {
  const deck = f.motion.surface;
  if (!f.motion.grounded || deck === undefined || !intentOpen(f, stage, deck)
    || f.platform.downAge >= DASH_FLICK_SAMPLES || stickZ(input) >= -CROUCH_STICK_THRESHOLD
    || input.attackRequested || input.specialPressed || f.attack.style !== undefined
    || f.special.action !== SpecialAction.none || f.jump.squat > 0 || f.shield.raised) return false;
  dropPlatform(f, stage, matchFrame, deck);
  return true;
}

export function beginPlatformContact(f: Fighter, stage: number, matchFrame: number, input: Readonly<Controls>, deck: number | undefined): boolean {
  if (deck === undefined || f.motion.grounded || !intentOpen(f, stage, deck) || input.walking || stickZ(input) >= -CROUCH_STICK_THRESHOLD || isAerialAttack(f.attack.style)) return false;
  dropPlatform(f, stage, matchFrame, deck);
  return true;
}

export function belowStandingPlatform(attacker: Readonly<Fighter>, target: Readonly<Fighter>, stage: number | undefined): boolean {
  const { motion } = attacker;
  if (stage === undefined || !motion.grounded || motion.surface === undefined || !surfacePass(stage, motion.surface)) return false;
  return addFloat32(target.motion.z, melee(bodyTop(target.character))) < motion.z;
}
