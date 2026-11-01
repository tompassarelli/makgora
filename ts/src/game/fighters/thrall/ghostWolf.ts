import { f32 } from "wisp/src/sim/f32";
import { heroRegion } from "../../sim/heroMoves";
import { hurtPart, hurtPose } from "../../sim/hurtboxes";
import { type AuthoredSpecial, type SpecialKit, frames } from "../../sim/specials/schema";
import { capsule, thrallHit } from "./moves";

export const GHOST_SHIFT = frames(1, 7);
export const GHOST_DASH = frames(8, 25);
export const GHOST_LEAP = frames(26, 30);
export const GHOST_GLIDE = frames(31, 35);
export const GHOST_END_FRAME = 46;
export const GHOST_DASH_SPEED = 15.0;
export const GHOST_LEAP_SPEED = 11.0;
export const GHOST_LEAP_RISE = 8.0;
export const GHOST_POUNCE_HIT = frames(GHOST_LEAP.first, GHOST_GLIDE.first + 2);
export const GHOST_LANDING_LAG = 22;
export const GHOST_COOLDOWN = 60;

const WOLF_BODY = [hurtPart(-44.0, 38.0, 40.0, 42.0, 26.0)];
const POUNCE = thrallHit(8.0, 45, 70.0, 30.0);

const ghostWolf = (air: boolean): AuthoredSpecial => ({
  name: "Ghost Wolf", endFrame: GHOST_END_FRAME, cooldownFrames: GHOST_COOLDOWN, landingLag: GHOST_LANDING_LAG,
  helpless: air, oncePerAirtime: air,
  hurt: [hurtPose(GHOST_DASH.first, GHOST_GLIDE.last, WOLF_BODY)],
  motion: [
    { ...GHOST_SHIFT, velocityX: 0.0, velocityZ: 0.0 },
    { ...GHOST_DASH, velocityX: GHOST_DASH_SPEED, velocityZ: 0.0 },
    { ...GHOST_LEAP, velocityX: GHOST_LEAP_SPEED, velocityZ: GHOST_LEAP_RISE },
    { ...GHOST_GLIDE, velocityX: GHOST_LEAP_SPEED, velocityZ: 0.0 },
  ],
  regions: [heroRegion(GHOST_POUNCE_HIT.first, GHOST_POUNCE_HIT.last, capsule(24.0, 36.0, f32(78.0), 50.0, 20.0), POUNCE)],
});

export const GHOST_WOLF: SpecialKit = {
  name: "Ghost Wolf",
  description: "Become a spirit wolf: dash forward low and fast, then pounce. The pounce hits; in the air it carries him back to the stage and leaves him helpless.",
  ground: ghostWolf(false), air: ghostWolf(true),
};
