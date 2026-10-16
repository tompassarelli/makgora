import { f32 } from "wisp/src/sim/f32";

interface FlameLevel {
  readonly model: string;
  readonly scale: number;
}

// Immolation keeps its particles in model space, so a moving candle leaves no fire trail.
export const CANDLE_FLAME_MODEL = "Abilities\\Spells\\Other\\ImmolationRed\\ImmolationRedTarget.mdx";

export const CANDLE_FLAMES: readonly FlameLevel[] = [
  { model: CANDLE_FLAME_MODEL, scale: f32(0.15) },
  { model: CANDLE_FLAME_MODEL, scale: f32(0.22) },
  { model: CANDLE_FLAME_MODEL, scale: f32(0.3) },
  { model: CANDLE_FLAME_MODEL, scale: f32(0.38) },
];

export const CANDLE_SMOKE: FlameLevel = {
  model: "Abilities\\Spells\\Human\\CloudOfFog\\CloudOfFog.mdx",
  scale: f32(0.15),
};
