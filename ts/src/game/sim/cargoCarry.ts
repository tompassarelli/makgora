import { f32 } from "wisp/src/sim/f32";
import { max, min } from "../core/numbers";
import { GrabAction } from "./codes";
import type { Fighter } from "./fighter";
import type { CargoCarry } from "./heroMoves";
import { GRAB_HOLD_DISTANCE } from "./moves";
import type { Controls } from "./roster";
import { clearDash } from "./groundMovement";

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
  if (input.cStickUpFlick) return GrabAction.throwUp;
  if (input.cStickZ < 0) return GrabAction.throwDown;
  if (input.cStickSideFlick !== 0) return input.cStickSideFlick === owner.facing ? GrabAction.throwForward : GrabAction.throwBack;
  if (!input.attackPressed) return GrabAction.none;
  if (input.verticalDirection !== 0) return input.verticalDirection > 0 ? GrabAction.throwUp : GrabAction.throwDown;
  return input.direction === -owner.facing ? GrabAction.throwBack : GrabAction.throwForward;
}

export function carryThrowRequested(owner: Readonly<Fighter>, input: Readonly<Controls>): boolean {
  return owner.motion.grounded && requestedCarryThrow(owner, input) !== GrabAction.none;
}

export function beginCarryJump(f: Fighter, shortHop: boolean): void {
  const { motion, jump } = f;
  if (!motion.grounded || jump.squat > 0 || f.launch.hitlag > 0) return;
  motion.crouching = false;
  clearDash(f);
  jump.squat = f.tuning.physics.jumpSquatFrames;
  jump.held = !shortHop;
}

export function lowerCarryJump(f: Fighter): void {
  const carry = cargoCarry(f);
  if (carry !== undefined) f.motion.vz = f32(f.motion.vz * carry.jumpScale);
}

export function limitCarrySpeed(f: Fighter): void {
  const carry = cargoCarry(f);
  if (carry === undefined) return;
  const physics = f.tuning.physics;
  const limit = f32((f.motion.grounded ? physics.walkSpeed : physics.airSpeed) * carry.walkScale);
  f.motion.vx = max(-limit, min(limit, f.motion.vx));
  if (f.motion.grounded) clearDash(f);
}

/** Where the carried fighter sits relative to its carrier, by the carrier's grab action and frame. */
export function carriedOffset(carry: CargoCarry, action: GrabAction, frame: number, contact: number, hoistFrames: number, facing: number): Readonly<CarryOffset> {
  const shoulderX = f32(facing * carry.shoulderX);
  const frontX = f32(facing * GRAB_HOLD_DISTANCE);
  if (action === GrabAction.hoist) {
    const progress = min(1.0, f32(f32(frame * 1.0) / hoistFrames));
    carryOffset.x = f32(frontX + f32(f32(shoulderX - frontX) * progress));
    carryOffset.z = f32(carry.shoulderZ * progress);
  } else if (action === GrabAction.throwUp) {
    const progress = min(1.0, f32(f32(frame * 1.0) / contact));
    carryOffset.x = f32(shoulderX * f32(1 - progress));
    carryOffset.z = f32(carry.shoulderZ + f32(carry.overheadRise * progress));
  } else if (action === GrabAction.throwDown) {
    const progress = min(1.0, f32(f32(frame * 1.0) / contact));
    carryOffset.x = f32(shoulderX + f32(f32(frontX - shoulderX) * progress));
    carryOffset.z = f32(carry.shoulderZ * f32(1 - progress));
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
