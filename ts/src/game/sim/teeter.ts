import { f32 } from "wisp/src/sim/f32";
import { AttackStyle, DownState, GroundAction, SpecialAction } from "./codes";
import { inGrabContext } from "./conditions";
import type { Fighter } from "./fighter";
import { clearDash } from "./groundMovement";
import { WALK_MIDDLE_STICK_THRESHOLD } from "./stickZones";
import * as stageSurfaces from "./stage";

export function canTeeter(f: Readonly<Fighter>, canSteer = true): boolean {
  const { motion, launch, shield } = f;
  return (canSteer || f.landing.lag > 0) && motion.grounded && !motion.crouching && f.attack.style === undefined && f.special.action === SpecialAction.none
    && f.ground.action !== GroundAction.turnRun && f.ground.pivotGraceFrames === 0
    && launch.hitstun <= 0 && f.down.state === DownState.none && f.jump.squat <= 0
    && launch.knockbackX === 0 && shield.pushbackX === 0 && shield.recoilX === 0;
}

export function shieldPressed(f: Readonly<Fighter>): boolean {
  return f.motion.grounded && (f.shield.pushbackX !== 0 || f.shield.stun > 0) && f.launch.hitstun <= 0 && f.down.state === DownState.none && !inGrabContext(f) && !f.status.out;
}

function edgeSide(f: Readonly<Fighter>, stage: number, matchFrame: number): number {
  const { motion } = f;
  const deck = motion.surface ?? 0;
  return motion.x > stageSurfaces.surfaceRight(stage, deck, matchFrame) ? 1 : motion.x < stageSurfaces.surfaceLeft(stage, deck, matchFrame) ? -1 : 0;
}

function stopAtEdge(f: Fighter, stage: number, matchFrame: number, side: number): void {
  const { motion } = f;
  const deck = motion.surface ?? 0;
  motion.x = side > 0 ? stageSurfaces.surfaceRight(stage, deck, matchFrame) : stageSurfaces.surfaceLeft(stage, deck, matchFrame);
  motion.vx = 0.0;
}

export function teeterAtEdge(f: Fighter, stage: number, matchFrame: number, horizontalStick: number, canSteer: boolean): boolean {
  const side = edgeSide(f, stage, matchFrame);
  if (side === 0 || (!canSteer && f.facing !== side) || f32(horizontalStick * side) >= WALK_MIDDLE_STICK_THRESHOLD) return false;
  stopAtEdge(f, stage, matchFrame, side);
  f.landing.lag = 0;
  clearDash(f);
  return true;
}

export function teeterShieldAtEdge(f: Fighter, stage: number, matchFrame: number): boolean {
  const side = edgeSide(f, stage, matchFrame);
  if (side === 0) return false;
  stopAtEdge(f, stage, matchFrame, side);
  f.shield.pushbackX = 0.0;
  return true;
}

export function grabHoldsEdge(f: Readonly<Fighter>): boolean {
  return f.motion.grounded && f.attack.style === AttackStyle.grab;
}

export function stopGrabAtEdge(f: Fighter, stage: number, matchFrame: number): void {
  const side = edgeSide(f, stage, matchFrame);
  if (side !== 0) stopAtEdge(f, stage, matchFrame, side);
}
