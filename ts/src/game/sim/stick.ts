


import { f32 } from "wisp/src/sim/f32";
import { DIAGONAL_UNIT } from "./knockback";
import type { Controls } from "./roster";

const sign = (value: number) => (value === 0 ? 0 : value > 0 ? 1 : -1);

/** Tilt while shielding stays below tap jump 0.6625 and rolls/spot dodge 0.7. */
export const SHIELD_TILT_STICK_CAP = 0.6499999761581421;

/** The tilt modifier scales each axis to one Melee stick unit (0.0125) inside dash 0.8, tap jump 0.6625 and crouch 0.6875. */
export const TILT_STICK_X = f32(0.7875);
export const TILT_STICK_UP = f32(0.65);
export const TILT_STICK_DOWN = f32(0.675);

export function tiltStickX(x: number): number {
  return f32(x * TILT_STICK_X);
}

export function tiltStickZ(z: number): number {
  return f32(z * (z < 0 ? TILT_STICK_DOWN : TILT_STICK_UP));
}

function shieldStick(value: number, input: Readonly<Controls>): number {
  return input.walking && input.shield ? Math.max(-SHIELD_TILT_STICK_CAP, Math.min(SHIELD_TILT_STICK_CAP, value)) : value;
}

function analogStick(input: Readonly<Controls>): boolean {
  return input.diStickValid && (input.diStickX !== 0 || input.diStickZ !== 0);
}

function digitalScale(input: Readonly<Controls>): number {
  return input.direction !== 0 && input.verticalDirection !== 0 ? DIAGONAL_UNIT : 1.0;
}

export function stickX(input: Readonly<Controls>): number {
  return shieldStick(analogStick(input) ? input.diStickX : f32(sign(input.direction) * digitalScale(input)), input);
}

export function stickZ(input: Readonly<Controls>): number {
  return shieldStick(analogStick(input) ? input.diStickZ : f32(sign(input.verticalDirection) * digitalScale(input)), input);
}
