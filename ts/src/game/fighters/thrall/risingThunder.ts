import { f32 } from "wisp/src/sim/f32";
import { HitElement } from "../../sim/codes";
import { HERO_REFERENCE_HEIGHT, heroRegion, type MoveRegion } from "../../sim/heroMoves";
import type { HitEffect } from "../../sim/hitRegions";
import { type AuthoredSpecial, FollowUpInput, type SpecialProjectile, frames } from "../../sim/specials/schema";
import { HammerGrip, type HammerSwing, STANDING_SHOULDER, capsule, swingReach, thrallHit, wholeCapsule } from "./moves";

const h = (multiple: number) => f32(HERO_REFERENCE_HEIGHT * multiple);

export const RISING_THUNDER_CAST = 6;
export const RISING_THUNDER_RISE = { first: 7, last: 23 } as const;
export const RISING_THUNDER_APEX = { first: 24, last: 26 } as const;
export const RISING_THUNDER_END = 40;
export const RISING_THUNDER_HIT_END = 2;
export const RISING_THUNDER_HOP = 12.0;
export const RISING_THUNDER_SET_KNOCKBACK = 60.0;
export const RISING_THUNDER_LANDING_LAG = 30;
export const RISING_THUNDER_HEIGHT = h(f32(4.0));
export const RISING_THUNDER_STEER = h(f32(1.5));
const LINK_FRAMES = 3;

export const RISING_THUNDER_SWING: HammerSwing = {
  pivot: STANDING_SHOULDER, hand: 34.0, grip: HammerGrip.tilt, radius: 28.0,
  beats: [{ frame: 7, angle: 0.0 }, { frame: 10, angle: 20.0 }, { frame: 13, angle: 40.0 }, { frame: 16, angle: 58.0 }, { frame: 19, angle: 74.0 }, { frame: RISING_THUNDER_APEX.first, angle: 90.0 }],
};
const RISE_BEATS = RISING_THUNDER_SWING.beats.slice(0, -1);

export const RISING_THUNDER_ERUPTION: Readonly<HitEffect> = { ...thrallHit(3.0, 90, 100.0, 0.0), setKnockback: 80.0 };
export const RISING_THUNDER_LINK: Readonly<HitEffect> = { ...thrallHit(1.5, 85, 100.0, 0.0, false, HitElement.electric), setKnockback: 30.0, carry: true };
export const RISING_THUNDER_FINISH: Readonly<HitEffect> = { ...thrallHit(8.0, 85, 100.0, 0.0, false, HitElement.electric), electric: true, setKnockback: RISING_THUNDER_SET_KNOCKBACK };

const ERUPTION_CAPSULE = capsule(-46.0, 8.0, 58.0, 8.0, 24.0);
const BODY_CAPSULE = capsule(6.0, 24.0, 10.0, 104.0, 26.0);
export const RISING_THUNDER_BURST = capsule(0.0, 150.0, 0.0, 196.0, 58.0);

const regions = (): MoveRegion[] => [
  heroRegion(RISING_THUNDER_CAST - 1, RISING_THUNDER_CAST, ERUPTION_CAPSULE, RISING_THUNDER_ERUPTION),
  ...RISE_BEATS.flatMap((beat) => [
    heroRegion(beat.frame, beat.frame + LINK_FRAMES - 1, wholeCapsule(RISING_THUNDER_SWING, beat.angle), RISING_THUNDER_LINK),
    heroRegion(beat.frame, beat.frame + LINK_FRAMES - 1, BODY_CAPSULE, RISING_THUNDER_LINK),
  ]),
  heroRegion(RISING_THUNDER_APEX.first, RISING_THUNDER_APEX.last, wholeCapsule(RISING_THUNDER_SWING, 90.0), RISING_THUNDER_FINISH),
  heroRegion(RISING_THUNDER_APEX.first, RISING_THUNDER_APEX.last, RISING_THUNDER_BURST, RISING_THUNDER_FINISH),
];

const mark = (model: string, spawnFrame: number, life: number, offsetX: number, offsetZ: number, modelRadius: number): SpecialProjectile => ({
  model, spawnFrame, offsetX, offsetZ, velocityX: 0.0, velocityZ: 0.0, life, radius: 1.0, modelRadius, activeFrom: life + 1,
  effect: thrallHit(0.0, 90, 0.0, 0.0), reflectable: false, limit: 2,
});
export const RISING_THUNDER_ERUPTION_MODEL = "Abilities\\Spells\\Orc\\WarStomp\\WarStompCaster.mdx";
export const RISING_THUNDER_APEX_MODEL = "Abilities\\Spells\\Other\\Monsoon\\MonsoonBoltTarget.mdx";
export const RISING_THUNDER_BURST_MODEL = "Abilities\\Spells\\Human\\Thunderclap\\ThunderClapCaster.mdx";
const marks = (): SpecialProjectile[] => [
  mark(RISING_THUNDER_ERUPTION_MODEL, RISING_THUNDER_CAST, 24, 6.0, 0.0, f32(1.0 / f32(0.9))),
  mark(RISING_THUNDER_APEX_MODEL, RISING_THUNDER_APEX.first, 18, 0.0, 0.0, f32(1.0 / f32(0.8))),
  mark(RISING_THUNDER_BURST_MODEL, RISING_THUNDER_APEX.first, 16, 0.0, 174.0, f32(1.0 / f32(0.55))),
];

const riseFrames = RISING_THUNDER_RISE.last - RISING_THUNDER_RISE.first + 1;

export const RISING_THUNDER_STRUCK: AuthoredSpecial = { endFrame: RISING_THUNDER_HIT_END, landingLag: 4, motion: [{ ...frames(1, RISING_THUNDER_HIT_END), velocityX: 0.0, velocityZ: RISING_THUNDER_HOP }] };

export const RISING_THUNDER: AuthoredSpecial = {
  endFrame: RISING_THUNDER_END, facesStick: true, oncePerAirtime: true, helplessOnMiss: true,
  landingLag: RISING_THUNDER_LANDING_LAG, whiffLandingLag: RISING_THUNDER_LANDING_LAG,
  motion: [
    { ...frames(1, RISING_THUNDER_CAST), velocityX: 0.0, velocityZ: 0.0 },
    { ...frames(RISING_THUNDER_RISE.first, RISING_THUNDER_RISE.last), velocityX: 0.0, velocityZ: f32(RISING_THUNDER_HEIGHT / riseFrames), driftSpeed: f32(RISING_THUNDER_STEER / riseFrames) },
    { ...frames(RISING_THUNDER_APEX.first, RISING_THUNDER_APEX.last), velocityX: 0.0, velocityZ: 0.0 },
  ],
  regions: regions(),
  rehits: [...RISE_BEATS.map((beat) => beat.frame), RISING_THUNDER_APEX.first],
  projectiles: marks(),
  hurt: [swingReach(RISING_THUNDER_SWING, RISING_THUNDER_RISE.first, RISING_THUNDER_APEX.last)],
  followUps: [{ window: frames(RISING_THUNDER_APEX.last + 1, RISING_THUNDER_APEX.last + 1), input: FollowUpInput.contact, special: RISING_THUNDER_STRUCK }],
};
