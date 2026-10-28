import { f32 } from "wisp/src/sim/f32";
import { QUICKDRAW_CHARGE } from "../fighters/blademaster/specials";

const GLOW_SCALE = { least: f32(0.15), most: f32(0.9) } as const;
const GLOW_MODEL = "Abilities\\Weapons\\FarseerMissile\\FarseerMissile.mdx";
const RED: readonly [number, number, number] = [255, 60, 40];
const CUE_SECONDS = f32(0.2);

const glow = (scale: number) => ({ model: GLOW_MODEL, anchor: "hand" as const, scale, sequence: "stand", seconds: CUE_SECONDS, pitch: 0.0, color: RED });
const glowScale = (stage: number): number =>
  f32(GLOW_SCALE.least + f32(f32(f32(GLOW_SCALE.most - GLOW_SCALE.least) * stage) / QUICKDRAW_CHARGE.stages));

const CHARGING_GLOW = { ...glow(GLOW_SCALE.least), scaleEnd: GLOW_SCALE.most, scaleFrames: QUICKDRAW_CHARGE.hold + QUICKDRAW_CHARGE.full };
const FULL_FLASH = { model: "Abilities\\Spells\\Human\\HolyBolt\\HolyBoltSpecialArt.mdx", anchor: "hand" as const, scale: f32(0.8), sequence: "birth", seconds: CUE_SECONDS, pitch: 0.0 };
const SLASH = { model: "Abilities\\Weapons\\GlaiveMissile\\GlaiveMissileTarget.mdx", anchor: "ahead" as const, scale: f32(0.6), sequence: "birth", seconds: CUE_SECONDS, pitch: 0.0 };

export const QUICKDRAW_STANCE_CUES = { spell: "Quickdraw", startup: CHARGING_GLOW, active: CHARGING_GLOW };

const drawCues = (stage: number) =>
  ({ spell: "Quickdraw", startup: stage < QUICKDRAW_CHARGE.stages ? glow(glowScale(stage)) : FULL_FLASH, active: SLASH, trail: true as const });

export const QUICKDRAW_DRAW_CUES = Array.from({ length: QUICKDRAW_CHARGE.stages + 1 }, (_, stage) => drawCues(stage));
