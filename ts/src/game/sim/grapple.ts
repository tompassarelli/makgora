import { max, min } from "../core/numbers";
import { f32 } from "wisp/src/sim/f32";
import { AttackPhase, AttackStyle, GrappleState, LedgeState } from "./codes";
import { attackPhase } from "./conditions";
import { finishLanding } from "./down";
import type { Fighter } from "./fighter";
import type { GrappleSpec } from "./heroMoves";
import { moveMeleeX, setWorldMotionValue } from "./motion";
import { type Controls, copyControls, neutralControls } from "./roster";
import { mainDeckUndersideZ, surfaceCount, surfaceLeft, surfaceRight, surfaceZ } from "./stage";
import { stickZ } from "./stick";
import { cancelAttack } from "./transitions";
import { squareRoot } from "./warcraftMath";

const AIM_FORWARD = 1;
const AIM_UP = 2;
const AIM_UP_STICK = 0.5;
const REEL_STICK = 0.5;
const LATCH_SAMPLES = 8;
const MAIN_DECK = 0;

const jumpless: Controls = neutralControls();

function aimDirection(f: Readonly<Fighter>, spec: Readonly<GrappleSpec>): { x: number; z: number } {
  return f.grapple.aim === AIM_UP ? { x: f32(f.facing * spec.aimUpX), z: spec.aimUpZ } : { x: f.facing, z: 0.0 };
}

function anchorWorldX(f: Readonly<Fighter>, stage: number, matchFrame: number): number {
  return f32(surfaceLeft(stage, f.grapple.surface, matchFrame) + f.grapple.anchorX);
}

function anchorWorldZ(f: Readonly<Fighter>, stage: number, matchFrame: number): number {
  return f32(surfaceZ(stage, f.grapple.surface, matchFrame) + f.grapple.anchorZ);
}

function release(f: Fighter): void {
  const g = f.grapple;
  g.state = GrappleState.none;
  g.frame = 0;
  g.surface = 0;
  g.anchorX = 0.0;
  g.anchorZ = 0.0;
  g.length = 0.0;
}

function latchAt(f: Fighter, spec: Readonly<GrappleSpec>, surface: number, stage: number, matchFrame: number, x: number, z: number, handZ: number): void {
  const g = f.grapple;
  const dx = f32(x - f.motion.x);
  const dz = f32(z - handZ);
  g.state = GrappleState.latched;
  g.frame = 0;
  g.surface = surface;
  g.anchorX = f32(x - surfaceLeft(stage, surface, matchFrame));
  g.anchorZ = f32(z - surfaceZ(stage, surface, matchFrame));
  g.length = min(spec.maxLength, max(f32(spec.minLength + 1.0), squareRoot(f32(f32(dx * dx) + f32(dz * dz)))));
  g.spent = true;
  cancelAttack(f);
}

function touches(sampleX: number, sampleZ: number, left: number, right: number, z: number, radius: number): boolean {
  const dx = f32(sampleX - min(right, max(left, sampleX)));
  const dz = f32(sampleZ - z);
  return f32(f32(dx * dx) + f32(dz * dz)) <= f32(radius * radius);
}

function latchPoint(f: Fighter, spec: Readonly<GrappleSpec>, stage: number, matchFrame: number): boolean {
  const aim = aimDirection(f, spec);
  const handZ = f32(f.motion.z + spec.handHeight);
  for (let step = 1; step <= LATCH_SAMPLES; step++) {
    const along = f32(f32(spec.reach * step) / LATCH_SAMPLES);
    const x = f32(f.motion.x + f32(aim.x * along));
    const z = f32(handZ + f32(aim.z * along));
    for (let surface = 0; surface < surfaceCount(stage); surface++) {
      const left = surfaceLeft(stage, surface, matchFrame);
      const right = surfaceRight(stage, surface, matchFrame);
      const top = surfaceZ(stage, surface, matchFrame);
      if (touches(x, z, left, right, top, spec.latchRadius)) {
        latchAt(f, spec, surface, stage, matchFrame, min(right, max(left, x)), top, handZ);
        return true;
      }
      const under = mainDeckUndersideZ(stage);
      if (surface === MAIN_DECK && touches(x, z, left, right, under, spec.latchRadius)) {
        latchAt(f, spec, surface, stage, matchFrame, min(right, max(left, x)), under, handZ);
        return true;
      }
    }
  }
  return false;
}

function constrainToChain(f: Fighter, spec: Readonly<GrappleSpec>, stage: number, matchFrame: number): void {
  const { motion, grapple } = f;
  const ax = anchorWorldX(f, stage, matchFrame);
  const az = anchorWorldZ(f, stage, matchFrame);
  const handZ = f32(motion.z + spec.handHeight);
  const dx = f32(motion.x - ax);
  const dz = f32(handZ - az);
  const distance = squareRoot(f32(f32(dx * dx) + f32(dz * dz)));
  if (distance <= grapple.length || distance === 0.0) return;
  const nx = f32(dx / distance);
  const nz = f32(dz / distance);
  moveMeleeX(f, f32(f32(ax + f32(nx * grapple.length)) - motion.x));
  motion.z = f32(f32(az + f32(nz * grapple.length)) - spec.handHeight);
  setWorldMotionValue(motion.meleeZ, motion.z);
  const outward = f32(f32(motion.vx * nx) + f32(motion.vz * nz));
  if (outward <= 0.0) return;
  motion.vx = f32(motion.vx - f32(outward * nx));
  motion.vz = f32(motion.vz - f32(outward * nz));
  setWorldMotionValue(motion.meleeVelocityZ, motion.vz);
}

function pullOnto(f: Fighter, spec: Readonly<GrappleSpec>, stage: number, matchFrame: number, input: Readonly<Controls>): void {
  const { motion, grapple } = f;
  const surface = grapple.surface;
  const left = f32(surfaceLeft(stage, surface, matchFrame) + spec.pullUpMargin);
  const right = f32(surfaceRight(stage, surface, matchFrame) - spec.pullUpMargin);
  const x = anchorWorldX(f, stage, matchFrame);
  const underDeck = surface === MAIN_DECK && grapple.anchorZ < 0.0;
  const target = underDeck ? (x < f32(f32(left + right) / 2.0) ? left : right) : min(right, max(left, x));
  moveMeleeX(f, f32(target - motion.x));
  motion.z = surfaceZ(stage, surface, matchFrame);
  setWorldMotionValue(motion.meleeZ, motion.z);
  release(f);
  finishLanding(f, stage, matchFrame, input, surface, false);
  f.landing.lag = 0;
}

/** A jump press while hanging lets go and is spent doing so, so the swing's speed is kept instead of being replaced by a jump. */
export function grappleInput(f: Fighter, input: Readonly<Controls>): Readonly<Controls> {
  if (f.grapple.state !== GrappleState.latched || !input.jumpPressed) return input;
  release(f);
  copyControls(jumpless, input);
  jumpless.jumpPressed = false;
  jumpless.shortHopPressed = false;
  return jumpless;
}

function grounded(f: Readonly<Fighter>): boolean {
  return f.motion.grounded || f.ledge.state !== LedgeState.none || f.status.out;
}

/** Runs after the frame's ordinary air motion: records the claw's aim, latches it, then holds a latched fighter on his chain. */
function aimAndLatch(f: Fighter, spec: Readonly<GrappleSpec>, stage: number, matchFrame: number): void {
  const g = f.grapple;
  if (f.attack.style !== AttackStyle.grapple) {
    g.aim = 0;
    return;
  }
  if (g.aim === 0) g.aim = AIM_FORWARD;
  if (!g.spent && attackPhase(f) === AttackPhase.active) latchPoint(f, spec, stage, matchFrame);
}

function holdChain(f: Fighter, spec: Readonly<GrappleSpec>, stage: number, matchFrame: number, input: Readonly<Controls>): void {
  const g = f.grapple;
  g.aim = 0;
  g.frame++;
  if (g.frame > spec.hangFrames || f.dodge.airDodging) {
    release(f);
    return;
  }
  const stick = stickZ(input);
  if (stick >= REEL_STICK) g.length = f32(g.length - spec.reelSpeed);
  else if (stick <= -REEL_STICK) g.length = min(spec.maxLength, f32(g.length + spec.reelSpeed));
  if (g.length <= spec.minLength) {
    pullOnto(f, spec, stage, matchFrame, input);
    return;
  }
  constrainToChain(f, spec, stage, matchFrame);
}

export function advanceGrapple(f: Fighter, stage: number, matchFrame: number, input: Readonly<Controls>): void {
  const spec = f.tuning.moves?.grapple;
  if (spec === undefined) return;
  const g = f.grapple;
  if (grounded(f)) {
    g.spent = false;
    g.aim = 0;
    if (g.state === GrappleState.latched) release(f);
    return;
  }
  if (f.launch.hitstun > 0) {
    g.spent = false;
    g.aim = 0;
    release(f);
    return;
  }
  if (f.launch.hitlag > 0 || f.status.frozenFrames > 0) return;
  if (g.state === GrappleState.none) aimAndLatch(f, spec, stage, matchFrame);
  else holdChain(f, spec, stage, matchFrame, input);
}

/** Called on the frame the claw is fired: up on the stick sends it 45 degrees upward, otherwise it goes straight ahead. */
export function aimGrapple(f: Fighter, input: Readonly<Controls>): void {
  f.grapple.aim = stickZ(input) >= AIM_UP_STICK ? AIM_UP : AIM_FORWARD;
}
