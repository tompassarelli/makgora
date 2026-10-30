import { f32 } from "wisp/src/sim/f32";
import type { Fighter } from "../fighter";
import type { Controls } from "../roster";
import type { AuthoredSpecial } from "./schema";

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

export function steerAim(special: Fighter["special"], move: Readonly<AuthoredSpecial>, input: Readonly<Controls>): void {
  if (freeAims(move) && aimFree(special, input)) return;
  const x = chargedAimX(input);
  const z = chargedAimZ(input);
  if (x === 0 && z === 0) return;
  special.aimX = x;
  special.aimZ = z;
}

export function freeAims(move: Readonly<AuthoredSpecial>): boolean {
  for (const segment of move.motion ?? []) if (segment.freeAim === true) return true;
  return false;
}

export function aimFree(special: Fighter["special"], input: Readonly<Controls>): boolean {
  if (!input.diStickValid || (input.diStickX === 0.0 && input.diStickZ === 0.0)) return false;
  special.aimX = input.diStickX;
  special.aimZ = input.diStickZ;
  return true;
}

export function startAim(special: Fighter["special"], move: Readonly<AuthoredSpecial>, input: Readonly<Controls>): void {
  const aimX = input.specialX !== 0 ? input.specialX : input.direction;
  const aimZ = input.specialZ !== 0 ? input.specialZ : input.verticalDirection;
  special.aimX = aimX < 0 ? -1 : aimX > 0 ? 1 : 0;
  special.aimZ = aimZ < 0 ? -1 : aimZ > 0 ? 1 : 0;
  if (freeAims(move)) aimFree(special, input);
}
