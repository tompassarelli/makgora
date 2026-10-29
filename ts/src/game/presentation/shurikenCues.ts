import { f32 } from "wisp/src/sim/f32";
import { SpecialAction } from "../sim/codes";
import type { Fighter } from "../sim/fighter";
import { chargeStage } from "../sim/specials/schema";
import { SHURIKEN_CHARGE, SHURIKEN_MOST, shurikenCount } from "../fighters/akama/specials";

export const SHURIKEN_GLOW_MODEL = "Abilities\\Weapons\\FarseerMissile\\FarseerMissile.mdx";
export const SHURIKEN_GLOW_ON_HAND = { x: 30.0, z: 70.0 } as const;
export const SHURIKEN_GLOW_COLOR: readonly [number, number, number] = [90, 190, 255];
const GLOW_LEAST = f32(0.15);
const GLOW_MOST = f32(0.7);
const CUE_SECONDS = f32(0.2);

export const shurikensStored = (charge: number): number => charge <= 0 ? 0 : shurikenCount(chargeStage(SHURIKEN_CHARGE, charge));

export const shurikenGlowScale = (count: number): number => f32(GLOW_LEAST + f32(f32(f32(GLOW_MOST - GLOW_LEAST) * Math.max(0, count - 1)) / (SHURIKEN_MOST - 1)));

export const shurikenGlowShown = (fighter: Readonly<Fighter>): boolean =>
  !fighter.status.out && fighter.special.charge > 0 && fighter.special.action !== SpecialAction.heroNeutral;

const CHARGING_GLOW = {
  model: SHURIKEN_GLOW_MODEL, anchor: "hand" as const, scale: GLOW_LEAST, scaleEnd: GLOW_MOST, scaleFrames: SHURIKEN_CHARGE.hold + SHURIKEN_CHARGE.full,
  sequence: "stand", seconds: CUE_SECONDS, pitch: 0.0, color: SHURIKEN_GLOW_COLOR,
};

export const SHURIKEN_CHARGE_CUES = { spell: "Shuriken Volley", startup: CHARGING_GLOW, active: CHARGING_GLOW };
