import { min } from "../core/numbers";
import { addFloat32, subtractFloat32 } from "wisp/src/sim/binary32";
import { f32 } from "wisp/src/sim/f32";
import { DownState, SpecialAction } from "./codes";
import { isAerialAttack } from "./moves";
import { finishLanding } from "./down";
import { type Fighter, PLATFORM_DROP_INPUT_WINDOW } from "./fighter";
import { setWorldMotionValue, slopedLandingZ, totalVelocityZ } from "./motion";
import type { Controls } from "./roster";
import { type GroundLine, surfaceCount, surfaceLeft, surfaceLine, surfaceMoves, surfacePass, surfaceRight, surfaceShiftX, surfaceShiftZ, surfaceZ } from "./stage";
import { heroMotionPassesPlatforms } from "./specials/heroMotion";
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

export function passesThroughPlatform(f: Readonly<Fighter>, stage: number, input: Readonly<Controls>, deck: number | undefined): boolean {
  return deck !== undefined && !f.motion.grounded && intentOpen(f, stage, deck) && !input.walking && stickZ(input) < -CROUCH_STICK_THRESHOLD && !isAerialAttack(f.attack.style);
}

export function belowStandingPlatform(attacker: Readonly<Fighter>, target: Readonly<Fighter>, stage: number | undefined): boolean {
  const { motion } = attacker;
  if (stage === undefined || !motion.grounded || motion.surface === undefined || !surfacePass(stage, motion.surface)) return false;
  return addFloat32(target.motion.z, melee(bodyTop(target.character))) < motion.z;
}

const landingRise: { value: number | undefined } = { value: undefined };

function landingRiseOf(f: Fighter): number {
  if (landingRise.value === undefined) landingRise.value = totalVelocityZ(f);
  return landingRise.value;
}

function slopedLandingCandidate(f: Fighter, line: GroundLine, standing: boolean, oldX: number, oldZ: number, bestZ: number | undefined): number | undefined {
  const { motion } = f;
  const lineZ = slopedLandingZ(line, standing, oldX, oldZ, motion.x, motion.z);
  if (lineZ === undefined || (bestZ !== undefined && lineZ <= bestZ)) return undefined;
  return landingRiseOf(f) > 0 ? undefined : lineZ;
}

function crossesPlatformInBounds(f: Fighter, stage: number, matchFrame: number, i: number, fromX: number, fromZ: number, platformZ: number): boolean {
  const { motion } = f;
  const fraction = fromZ === motion.z ? 1.0 : f32(f32(fromZ - platformZ) / f32(fromZ - motion.z));
  const crossingX = f32(fromX + f32(f32(motion.x - fromX) * fraction));
  const left = surfaceLeft(stage, i, matchFrame);
  const right = surfaceRight(stage, i, matchFrame);
  return crossingX >= left && crossingX <= right && motion.x >= left && motion.x <= right;
}

function platformLandingCandidate(f: Fighter, stage: number, matchFrame: number, i: number, carried: number | undefined, oldX: number, oldZ: number, bestZ: number | undefined): number | undefined {
  const { motion } = f;
  const platformZ = surfaceZ(stage, i, matchFrame);
  const follows = i !== carried && surfaceMoves(stage, i);
  const fromZ = follows ? f32(oldZ + surfaceShiftZ(stage, i, matchFrame)) : oldZ;
  if (!(fromZ >= platformZ && motion.z <= platformZ)) return undefined;
  const rise = landingRiseOf(f);
  if ((follows ? f32(rise - surfaceShiftZ(stage, i, matchFrame)) : rise) > 0) return undefined;
  const fromX = follows ? f32(oldX + surfaceShiftX(stage, i, matchFrame)) : oldX;
  const inBounds = crossesPlatformInBounds(f, stage, matchFrame, i, fromX, fromZ, platformZ);
  return inBounds && (bestZ === undefined || platformZ > bestZ) ? platformZ : undefined;
}

export function landingDeck(f: Fighter, stage: number, matchFrame: number, oldX: number, oldZ: number, carried: number | undefined): number | undefined {
  landingRise.value = undefined;
  let landing: number | undefined;
  let landingZ = 0.0;
  const passesPlatforms = heroMotionPassesPlatforms(f);
  for (let i = 0; i < surfaceCount(stage); i++) {
    if (passesPlatforms && i !== 0) continue;
    const bestZ = landing === undefined ? undefined : landingZ;
    const line = surfaceLine(stage, i);
    const candidateZ =
      line !== undefined
        ? slopedLandingCandidate(f, line, i === carried, oldX, oldZ, bestZ)
        : platformLandingCandidate(f, stage, matchFrame, i, carried, oldX, oldZ, bestZ);
    if (candidateZ === undefined) continue;
    landing = i;
    landingZ = candidateZ;
  }
  return landing;
}
