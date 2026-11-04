import { at } from "wisp/src/runtime/lookup";
import { f32 } from "wisp/src/sim/f32";
import { type Roster, fighterAt, isActive } from "../../game/sim/roster";

// Presentation only: these offsets move drawn bodies and must never reach the simulation, replays or checksums.
export const EASE_RETAIN = f32(0.7);
export const EASE_SNAP_UNITS = 160;
const EASE_REST_UNITS = 1;
const SLOTS = 4;

export interface CorrectionEase {
  readonly beforeX: number[];
  readonly beforeZ: number[];
  readonly beforeIn: boolean[];
  readonly x: number[];
  readonly z: number[];
}

export interface EasedTick {
  pop: number;
  visible: number;
}

const zeros = (): number[] => Array.from({ length: SLOTS }, () => 0);

export function createCorrectionEase(): CorrectionEase {
  return { beforeX: zeros(), beforeZ: zeros(), beforeIn: Array.from({ length: SLOTS }, () => false), x: zeros(), z: zeros() };
}

export function clearCorrectionEase(ease: CorrectionEase): void {
  ease.x.fill(0);
  ease.z.fill(0);
}

const drawnIn = (world: Readonly<Roster>, slot: number): boolean => isActive(world, slot) && !fighterAt(world, slot).status.out;

export function noteEaseBefore(ease: CorrectionEase, world: Readonly<Roster>): void {
  for (let slot = 0; slot < SLOTS; slot++) {
    const motion = world.fighters[slot]?.motion;
    ease.beforeX[slot] = motion === undefined ? 0 : motion.x;
    ease.beforeZ[slot] = motion === undefined ? 0 : motion.z;
    ease.beforeIn[slot] = drawnIn(world, slot);
  }
}

const length = (x: number, z: number): number => Math.sqrt(x * x + z * z);

export function easeCorrections(ease: CorrectionEase, world: Readonly<Roster>, corrected: boolean, out: EasedTick): void {
  out.pop = 0;
  out.visible = 0;
  for (let slot = 0; slot < SLOTS; slot++) {
    const motion = world.fighters[slot]?.motion;
    const active = motion !== undefined && isActive(world, slot);
    const jumpX = corrected && active ? motion.x - at(ease.beforeX, slot) : 0;
    const jumpZ = corrected && active ? motion.z - at(ease.beforeZ, slot) : 0;
    out.pop = Math.max(out.pop, Math.floor(length(jumpX, jumpZ)));
    if (!drawnIn(world, slot) || !at(ease.beforeIn, slot)) {
      ease.x[slot] = 0;
      ease.z[slot] = 0;
      continue;
    }
    const heldX = at(ease.x, slot) - jumpX;
    const heldZ = at(ease.z, slot) - jumpZ;
    const held = length(heldX, heldZ);
    const eased = held <= EASE_SNAP_UNITS && held * EASE_RETAIN >= EASE_REST_UNITS;
    out.visible = Math.max(out.visible, Math.floor(eased ? held * (1 - EASE_RETAIN) : held));
    ease.x[slot] = eased ? heldX * EASE_RETAIN : 0;
    ease.z[slot] = eased ? heldZ * EASE_RETAIN : 0;
  }
}
