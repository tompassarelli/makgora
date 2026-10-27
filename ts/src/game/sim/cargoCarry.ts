import { f32 } from "wisp/src/sim/f32";
import { min } from "../core/numbers";
import { GrabAction } from "./codes";
import type { Fighter } from "./fighter";
import type { CargoCarry } from "./heroMoves";
import { moveMeleeX } from "./motion";
import { GRAB_HOLD_DISTANCE } from "./moves";
import type { Controls } from "./roster";
import * as stageSurfaces from "./stage";
import { stopGrabAtEdge } from "./teeter";

export interface CarryOffset {
  x: number;
  z: number;
}

const carryOffset: CarryOffset = { x: 0.0, z: 0.0 };

export function cargoCarry(f: Readonly<Fighter>): CargoCarry | undefined {
  return f.tuning.moves?.carry;
}

export function isCarrying(f: Readonly<Fighter>): boolean {
  return f.grab.action === GrabAction.carry && f.grab.target !== undefined && f.tuning.moves?.carry !== undefined;
}

export function requestedCarryThrow(owner: Readonly<Fighter>, input: Readonly<Controls>): GrabAction {
  if (input.cStickSideFlick !== 0) return input.cStickSideFlick === owner.facing ? GrabAction.throwForward : GrabAction.throwBack;
  if (input.attackPressed) return input.direction === -owner.facing ? GrabAction.throwBack : GrabAction.throwForward;
  return GrabAction.none;
}

export function advanceCarryWalk(f: Fighter, input: Readonly<Controls>, stage: number, matchFrame: number): void {
  const carry = cargoCarry(f);
  const { motion } = f;
  if (carry === undefined || !motion.grounded) return;
  if (requestedCarryThrow(f, input) !== GrabAction.none) {
    motion.vx = 0.0;
    return;
  }
  const direction = input.direction;
  if (direction !== 0) f.facing = direction;
  motion.vx = f32(direction * f32(f.tuning.physics.walkSpeed * carry.walkScale));
  const oldX = motion.x;
  const oldZ = motion.z;
  moveMeleeX(f, motion.vx);
  stopGrabAtEdge(f, stage, matchFrame);
  motion.z = stageSurfaces.surfaceZAt(stage, motion.surface ?? 0, matchFrame, motion.x);
  motion.deltaX = f32(motion.x - oldX);
  motion.deltaZ = f32(motion.z - oldZ);
}

/** Where the carried fighter sits relative to its carrier, by the carrier's grab action and frame. */
export function carriedOffset(carry: CargoCarry, action: GrabAction, frame: number, contact: number, hoistFrames: number, facing: number): Readonly<CarryOffset> {
  const shoulderX = f32(facing * carry.shoulderX);
  const frontX = f32(facing * GRAB_HOLD_DISTANCE);
  if (action === GrabAction.hoist) {
    const progress = min(1.0, f32(f32(frame * 1.0) / hoistFrames));
    carryOffset.x = f32(frontX + f32(f32(shoulderX - frontX) * progress));
    carryOffset.z = f32(carry.shoulderZ * progress);
  } else if (action === GrabAction.throwForward || action === GrabAction.throwBack) {
    const progress = min(1.0, f32(f32(frame * 1.0) / contact));
    const landingX = action === GrabAction.throwForward ? frontX : -frontX;
    carryOffset.x = f32(shoulderX + f32(f32(landingX - shoulderX) * progress));
    carryOffset.z = f32(carry.shoulderZ * f32(1 - f32(0.5 * progress)));
  } else {
    carryOffset.x = shoulderX;
    carryOffset.z = carry.shoulderZ;
  }
  return carryOffset;
}
