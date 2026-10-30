import { f32 } from "wisp/src/sim/f32";

const SMOKE = { model: "Abilities\\Spells\\Human\\Invisibility\\InvisibilityTarget.mdx", anchor: "body" as const, scale: f32(0.9), sequence: "birth", seconds: f32(0.75), pitch: 0.0 };
const SHADOW = { model: "Abilities\\Spells\\NightElf\\Blink\\BlinkCaster.mdx", anchor: "body" as const, scale: f32(0.7), sequence: "birth", seconds: f32(0.2), pitch: 0.0 };

export const SHADOW_STEP_CUES = { spell: "Shadow Step", startup: SMOKE, active: SHADOW, vanishes: true as const, trail: true as const };
