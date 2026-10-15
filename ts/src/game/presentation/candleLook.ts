import { f32 } from "wisp/src/sim/f32";

interface FlameLevel {
  readonly model: string;
  readonly scale: number;
}

export const CANDLE_FLAMES: readonly FlameLevel[] = [
  { model: "Abilities\\Spells\\Human\\FlameStrike\\FlameStrikeEmbers.mdx", scale: f32(0.35) },
  { model: "Environment\\SmallBuildingFire\\SmallBuildingFire2.mdx", scale: f32(0.25) },
  { model: "Environment\\SmallBuildingFire\\SmallBuildingFire0.mdx", scale: f32(0.35) },
  { model: "Environment\\LargeBuildingFire\\LargeBuildingFire1.mdx", scale: f32(0.3) },
];
