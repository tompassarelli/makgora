import { f32 } from "wisp/src/sim/f32";
import { idiv, imod } from "wisp/src/sim/intMath";
import { CANDLE_FLAME_BLUE_MODEL, CANDLE_FLAME_GREEN_MODEL, CANDLE_FLAME_RED_MODEL } from "../../generated/assets/candleAssetInfo";

interface FlameLevel {
  readonly model: string;
  readonly scale: number;
}

export const CANDLE_FLAME_MODELS: readonly string[] = [CANDLE_FLAME_RED_MODEL, CANDLE_FLAME_BLUE_MODEL, CANDLE_FLAME_GREEN_MODEL];

export const CANDLE_FLAME_SCALES: readonly number[] = [f32(0.55), f32(0.7), f32(0.85), f32(1.0)];

export const CANDLE_COLOUR_FRAMES = 120;

export function candleFlameColour(frame: number): number {
  return imod(idiv(frame, CANDLE_COLOUR_FRAMES), CANDLE_FLAME_MODELS.length);
}

export const CANDLE_SMOKE: FlameLevel = {
  model: "Abilities\\Spells\\Human\\CloudOfFog\\CloudOfFog.mdx",
  scale: f32(0.15),
};
