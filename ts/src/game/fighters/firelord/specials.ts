import { f32 } from "wisp/src/sim/f32";
import { Character, HitElement } from "../../sim/codes";
import { hurtCapsule } from "../../sim/geometry/contactGeometry";
import { groundHit } from "../../sim/heroes/groundNormals";
import { HERO_REFERENCE_HEIGHT } from "../../sim/heroMoves";
import type { AuthoredSpecial, SpecialKit, SpecialProjectile } from "../../sim/specials/schema";
import { standinCastBody } from "../standin/moves";

const h = (multiple: number): number => f32(HERO_REFERENCE_HEIGHT * f32(multiple));

export const RAZE_UNIT = h(f32(0.7));
export const RAZE_RADIUS = h(f32(0.35));
export const RAZE_FRONT = hurtCapsule(Character.firelord).radius;
export const RAZE_REACH: { readonly near: number; readonly mid: number; readonly far: number } = {
  near: f32(RAZE_FRONT + RAZE_UNIT), mid: f32(RAZE_FRONT + f32(2.0 * RAZE_UNIT)), far: f32(RAZE_FRONT + f32(3.0 * RAZE_UNIT)),
};
export const RAZE_READ_FRAME = 14;
export const RAZE_TELL_FRAMES = 10;
export const RAZE_ERUPT_FRAMES = 4;
export const RAZE_GLOW_FRAMES = 14;
export const RAZE_END_FRAME = 48;
export const RAZE_AIR_LANDING_LAG = 20;
export const RAZE_DAMAGE = 12.0;
const RAZE_FLOOR_REACH = h(f32(0.3));

const TELL_MODEL = "Abilities\\Spells\\Human\\FlameStrike\\FlameStrikeTarget.mdx";
const COLUMN_MODEL = "Abilities\\Spells\\Human\\FlameStrike\\FlameStrike1.mdx";
// FlameStrike1.mdx draws its column only in birth, fading in by 1.05 s and out by 5.1 s; the eruption and its glow play that stretch across their frames.
const COLUMN_FROM = f32(1.05);
const COLUMN_RATE = f32(f32(f32(5.1) - f32(1.05)) / f32((RAZE_ERUPT_FRAMES + RAZE_GLOW_FRAMES) / 60));
const COLUMN_ART_RADIUS = 155.0;

const column = (life: number, from: number): Pick<SpecialProjectile, "model" | "modelRadius" | "modelOffsetZ" | "modelAnimation" | "life"> => ({
  model: COLUMN_MODEL, modelRadius: COLUMN_ART_RADIUS, modelOffsetZ: f32(-RAZE_RADIUS), life,
  modelAnimation: { sequence: "birth", warningSeconds: from, activeSeconds: from, rate: COLUMN_RATE },
});

const base = { offsetX: 0.0, velocityX: 0.0, velocityZ: 0.0, radius: RAZE_RADIUS, reflectable: false, limit: 1 } as const;

const GLOW: SpecialProjectile = {
  ...base, ...column(RAZE_GLOW_FRAMES, f32(COLUMN_FROM + f32(COLUMN_RATE * f32(RAZE_ERUPT_FRAMES / 60)))),
  spawnFrame: 0, offsetZ: RAZE_RADIUS, activeFrom: RAZE_GLOW_FRAMES + 1, effect: groundHit(0.0, 85, 0.0, 0.0, HitElement.fire),
};

const ERUPTION: SpecialProjectile = {
  ...base, ...column(RAZE_ERUPT_FRAMES, COLUMN_FROM),
  spawnFrame: 0, offsetZ: RAZE_RADIUS, effect: groundHit(RAZE_DAMAGE, 85, 92.0, 30.0, HitElement.fire), expiresInto: GLOW,
};

const TELL: SpecialProjectile = {
  ...base, model: TELL_MODEL, spawnFrame: RAZE_READ_FRAME, offsetZ: 0.0, life: RAZE_TELL_FRAMES, activeFrom: RAZE_TELL_FRAMES + 1,
  effect: groundHit(0.0, 85, 0.0, 0.0, HitElement.fire), aimedReach: RAZE_REACH, onlyOnFloor: { reach: RAZE_FLOOR_REACH }, dropsToFloor: true, expiresInto: ERUPTION,
};

const raze = (air: boolean): AuthoredSpecial => ({
  name: "Lava Raze", endFrame: RAZE_END_FRAME, landingLag: air ? RAZE_AIR_LANDING_LAG : undefined,
  aimFrames: RAZE_READ_FRAME, liveAim: true, hurt: standinCastBody(Character.firelord, 8, RAZE_READ_FRAME + RAZE_TELL_FRAMES),
  projectiles: [TELL],
});

export const LAVA_RAZE: SpecialKit = {
  name: "Lava Raze",
  description: "A glowing crack opens in the ground and erupts in lava. The stick as the crack opens picks where: down, or no direction, one step ahead; down and forward, two; forward, three. In the air it erupts on the ground below.",
  ground: raze(false), air: raze(true),
};
