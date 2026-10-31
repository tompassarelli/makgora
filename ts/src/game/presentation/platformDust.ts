import { f32 } from "wisp/src/sim/f32";
import { max, min } from "../core/numbers";
import type { Fighter } from "../sim/fighter";
import { totalVelocityZ } from "../sim/motion";
import { surfaceLeft, surfacePass, surfaceRight, surfaceZ } from "../sim/stage";

export const PlatformCatch = { none: 0, landing: 1, mount: 2 } as const;
export type PlatformCatch = (typeof PlatformCatch)[keyof typeof PlatformCatch];

export const PLATFORM_BURST_SOFT = 1.0;
export const PLATFORM_BURST_SPAN = f32(0.8);
export const PLATFORM_MOUNT_SIZE = 1.0;
export const PLATFORM_LIP_HALF_WIDTH = 70.0;

export interface PlatformCatchEvent {
  kind: PlatformCatch;
  previousVelocityZ: number;
  size: number;
  lipX: number;
  lipZ: number;
}

export function createPlatformCatch(): PlatformCatchEvent {
  return { kind: PlatformCatch.none, previousVelocityZ: 0.0, size: 0.0, lipX: 0.0, lipZ: 0.0 };
}

export function capturePlatformCatchBefore(event: PlatformCatchEvent, fighter: Readonly<Fighter>): void {
  event.kind = PlatformCatch.none;
  event.previousVelocityZ = totalVelocityZ(fighter);
}

export function platformBurstSize(fallSpeed: number, fastFallSpeed: number): number {
  const ratio = min(1.0, f32(max(0.0, fallSpeed) / fastFallSpeed));
  return f32(PLATFORM_BURST_SOFT + f32(PLATFORM_BURST_SPAN * f32(ratio * ratio)));
}

export function detectPlatformCatch(event: PlatformCatchEvent, fighter: Readonly<Fighter>, landed: boolean, stage: number | undefined, stageFrame: number): void {
  const deck = fighter.motion.surface;
  if (!landed || stage === undefined || deck === undefined || !surfacePass(stage, deck)) return;
  const mount = event.previousVelocityZ > 0.0;
  event.kind = mount ? PlatformCatch.mount : PlatformCatch.landing;
  event.size = mount ? PLATFORM_MOUNT_SIZE : platformBurstSize(f32(-event.previousVelocityZ), fighter.tuning.physics.fastFallSpeed);
  const left = surfaceLeft(stage, deck, stageFrame);
  const right = surfaceRight(stage, deck, stageFrame);
  const half = f32(PLATFORM_LIP_HALF_WIDTH * event.size);
  event.lipX = f32(right - left) <= f32(half * 2.0) ? f32(f32(left + right) * 0.5) : max(f32(left + half), min(f32(right - half), fighter.motion.x));
  event.lipZ = surfaceZ(stage, deck, stageFrame);
}
