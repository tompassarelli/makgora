


import { f32 } from "wisp/src/sim/f32";
import { FROZEN_THRONE_STAGE } from "../sim/stage";


export interface PlatformPart {
  readonly model: string;

  readonly x: number;
  readonly y: number;
  readonly z: number;

  readonly scale: readonly [x: number, y: number, z: number];

  readonly yaw: number;
}

const ICE_FLOE = "Doodads\\Northrend\\Water\\North_IceFloe3\\North_IceFloe3.mdx";
const part = (model: string, x: number, y: number, z: number, scale: readonly [number, number, number], yaw = 0.0): PlatformPart => ({ model, x, y, z, scale, yaw });







const FLOE: readonly [number, number, number] = [f32(1.43), 0.5, f32(0.19)];
const FLOE_Z = f32(-8.7);
const FROZEN_THRONE_PLATFORMS: readonly (readonly PlatformPart[])[] = [
  [part(ICE_FLOE, f32(-1.5), 0, FLOE_Z, FLOE)],
  [part(ICE_FLOE, f32(1.5), 0, FLOE_Z, FLOE, 180)],
  [part(ICE_FLOE, f32(-1.5), 0, FLOE_Z, FLOE)],
];


export function platformParts(stage: number, index: number): readonly PlatformPart[] {
  if (stage !== FROZEN_THRONE_STAGE || index === 0) return [];
  return FROZEN_THRONE_PLATFORMS[index - 1] ?? [];
}


export const STOCK_PLATFORM_MODELS: readonly string[] = [...new Set(FROZEN_THRONE_PLATFORMS.flatMap((parts) => parts.map(({ model }) => model)))];
