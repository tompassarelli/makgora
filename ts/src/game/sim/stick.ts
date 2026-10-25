


import { f32 } from "wisp/src/sim/f32";
import { DIAGONAL_UNIT } from "./knockback";
import type { Controls } from "./roster";

const sign = (value: number) => (value === 0 ? 0 : value > 0 ? 1 : -1);

/** The tilt modifier scales each axis to one Melee stick unit (0.0125) inside roll and spot dodge 0.7, tap jump 0.6625 and crouch 0.6875. */
export const TILT_STICK_X = f32(0.6875);
export const TILT_STICK_UP = f32(0.65);
export const TILT_STICK_DOWN = f32(0.675);

export function tiltStickX(x: number): number {
  return f32(x * TILT_STICK_X);
}

export function tiltStickZ(z: number): number {
  return f32(z * (z < 0 ? TILT_STICK_DOWN : TILT_STICK_UP));
}

function analogStick(input: Readonly<Controls>): boolean {
  return input.diStickValid && (input.diStickX !== 0 || input.diStickZ !== 0);
}

function digitalScale(input: Readonly<Controls>): number {
  return input.direction !== 0 && input.verticalDirection !== 0 ? DIAGONAL_UNIT : 1.0;
}

export function stickX(input: Readonly<Controls>): number {
  if (analogStick(input)) return input.diStickX;
  const x = f32(sign(input.direction) * digitalScale(input));
  return input.walking ? tiltStickX(x) : x;
}

export function stickZ(input: Readonly<Controls>): number {
  if (analogStick(input)) return input.diStickZ;
  const z = f32(sign(input.verticalDirection) * digitalScale(input));
  return input.walking ? tiltStickZ(z) : z;
}
