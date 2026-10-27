import { f32 } from "wisp/src/sim/f32";
import type { Fighter } from "../fighter";
import type { Controls } from "../roster";

const SECTOR_TANGENT = 0.41421356797218323;

export function sectorX(x: number, z: number): number {
  return Math.abs(x) > f32(SECTOR_TANGENT * Math.abs(z)) ? (x < 0 ? -1 : 1) : 0;
}

export function sectorZ(x: number, z: number): number {
  return Math.abs(z) > f32(SECTOR_TANGENT * Math.abs(x)) ? (z < 0 ? -1 : 1) : 0;
}

export function chargedAimX(input: Readonly<Controls>): number {
  if (input.diStickValid && (input.diStickX !== 0 || input.diStickZ !== 0)) return sectorX(input.diStickX, input.diStickZ);
  return input.direction < 0 ? -1 : input.direction > 0 ? 1 : 0;
}

export function chargedAimZ(input: Readonly<Controls>): number {
  if (input.diStickValid && (input.diStickX !== 0 || input.diStickZ !== 0)) return sectorZ(input.diStickX, input.diStickZ);
  return input.verticalDirection < 0 ? -1 : input.verticalDirection > 0 ? 1 : 0;
}

export function launchZoneX(f: Readonly<Fighter>): number {
  const { aimX, aimZ } = f.special;
  return sectorX(aimX, aimX === 0 && aimZ === 0 ? 1 : aimZ);
}

export function launchZoneZ(f: Readonly<Fighter>): number {
  const { aimX, aimZ } = f.special;
  return sectorZ(aimX, aimX === 0 && aimZ === 0 ? 1 : aimZ);
}

export function changesAimZone(f: Readonly<Fighter>, x: number, z: number): boolean {
  return (x !== 0 || z !== 0) && (x !== launchZoneX(f) || z !== launchZoneZ(f));
}
