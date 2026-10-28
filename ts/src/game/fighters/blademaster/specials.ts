


import { withExKit } from "../../sim/exSpecialAuthoring";
import { f32 } from "wisp/src/sim/f32";
import { type AuthoredSpecial, type FighterSpecials, type SpecialPlacement, CHARGED_AIM_FRAMES, FollowUpInput, Relocation, chargedAngleMotion, frames } from "../../sim/specials/schema";
import { hurtPart, hurtPose } from "../../sim/hurtboxes";
import { L, capsule, cut, hit, length, reach } from "./moves";
import { path } from "../../sim/heroes/authoring";



const LOW_CUT_ARM = reach(46.0, 56.0);


export const AIR_LANDING_LAG = 20;


const windCutter: AuthoredSpecial = {
  endFrame: 40,
  hurt: [
      hurtPose(1, 8, [hurtPart(-32.0, 56.0, -48.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
      hurtPose(9, 11, [hurtPart(-56.0, 64.0, -40.0, 125.0, 35.0), hurtPart(0.0, 79.0, -8.0, 95.0, 41.0)]),
      hurtPose(12, 16, [hurtPart(-20.0, 20.0, -4.0, 86.0, 51.0), hurtPart(-49.0, 66.0, 20.0, 100.0, 29.0)]),
      hurtPose(17, 24, [hurtPart(0.0, 24.0, 16.0, 109.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
      hurtPose(25, 32, [hurtPart(0.0, 24.0, 16.0, 109.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
      hurtPose(33, 39, [hurtPart(16.0, 24.0, 16.0, 109.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
    ],
  projectiles: [{
    model: "Abilities\\Weapons\\WingedSerpentMissile\\WingedSerpentMissile.mdx",
    spawnFrame: 18,
    offsetX: 40.0,
    offsetZ: 45.0,
    velocityX: length(f32(0.14)),
    velocityZ: 0.0,
    life: 24,
    radius: length(f32(0.16)),
    effect: hit(4.647127628326416, "POKE", 35),
    reflectable: true,
    limit: 1,
  }],
};






export const WIND_WALK_GUARD = frames(5, 29);
export const WIND_WALK_END = 59;
export const WIND_WALK_FREEZE = 11;
export const WIND_WALK_STEP_FRAME = 8;
export const WIND_WALK_KICK = frames(WIND_WALK_FREEZE + 3, WIND_WALK_FREEZE + 9);
export const WIND_WALK_KICK_END = WIND_WALK_FREEZE + 35;
export const WIND_WALK_KICK_REACH = length(f32(2.5));
const STOP = { velocityX: 0.0, velocityZ: 0.0 };

const LIFT_KICK = path(WIND_WALK_KICK.first, [
  capsule(15.0, 45.0, 45.0, 150.0, 22.0),
  capsule(12.0, 50.0, 42.0, 170.0, 22.0),
  capsule(10.0, 55.0, 40.0, 180.0, 22.0),
  capsule(10.0, 55.0, 45.0, 175.0, 22.0),
  capsule(10.0, 55.0, 40.0, 180.0, 22.0),
  capsule(10.0, 55.0, 40.0, 180.0, 22.0),
  capsule(10.0, 55.0, 40.0, 180.0, 22.0),
], hit(7.0, "COUNTER", 90));

const windWalkKick = (air: boolean): AuthoredSpecial => ({
  name: "Wind Walk Kick",
  endFrame: WIND_WALK_KICK_END,
  intangible: frames(1, WIND_WALK_FREEZE + 5),
  motion: [
    { ...frames(1, WIND_WALK_STEP_FRAME - 1), ...STOP },
    { ...frames(WIND_WALK_STEP_FRAME, WIND_WALK_STEP_FRAME), ...STOP, relocate: Relocation.behindLocked, relocateReach: WIND_WALK_KICK_REACH },
  ],
  airStall: air ? frames(1, WIND_WALK_KICK.last) : undefined,
  regions: LIFT_KICK,
  hurt: [
    hurtPose(WIND_WALK_STEP_FRAME, WIND_WALK_KICK.first - 1, [hurtPart(0.0, 24.0, 10.0, 70.0, 35.0)]),
    hurtPose(WIND_WALK_KICK.first, WIND_WALK_KICK_END - 1, [hurtPart(0.0, 24.0, 10.0, 90.0, 30.0), hurtPart(10.0, 90.0, 30.0, 175.0, 20.0)]),
  ],
  landingLag: air ? AIR_LANDING_LAG : undefined,
});

const windWalk = (air: boolean): AuthoredSpecial => ({
  endFrame: WIND_WALK_END,
  motion: [{ ...frames(1, 1), ...STOP }],
  guard: { ...WIND_WALK_GUARD, heal: 0.0, counter: true, freezeFrames: WIND_WALK_FREEZE },
  followUps: [{ window: WIND_WALK_GUARD, input: FollowUpInput.guard, special: windWalkKick(air) }],
  landingLag: air ? AIR_LANDING_LAG : undefined,
});





const RISE_FRAMES = 14;
export const RISE_STARTUP = 4;
const RISE_AIM_FRAMES = CHARGED_AIM_FRAMES + RISE_STARTUP;
const rise = (distance: number) => chargedAngleMotion(length(distance), RISE_FRAMES, RISE_STARTUP);


const risingBlade: AuthoredSpecial = {
  endFrame: 24 + RISE_STARTUP,
  aimFrames: RISE_AIM_FRAMES,
  motion: rise(f32(4.1)),
  regions: path(RISE_AIM_FRAMES + 1, [
    capsule(74.0, 113.0, 188.0, 121.0),
    capsule(65.0, 114.0, 185.0, 121.0),
    capsule(35.0, 114.0, 141.0, 121.0),
    capsule(-1.0, 112.0, 55.0, 121.0),
    capsule(-31.0, 113.0, -43.0, 122.0),
    capsule(-51.0, 108.0, -103.0, 118.0),
  ], hit(6.970690727233887, "LAUNCH", 80)),
  hurt: [
      hurtPose(1, RISE_AIM_FRAMES, [hurtPart(0.0, 30.0, -16.0, 115.0, 45.0), hurtPart(-25.0, 90.0, 41.0, 115.0, 30.0)]),
      hurtPose(RISE_AIM_FRAMES + 1, 16 + RISE_STARTUP, [hurtPart(-4.0, 25.0, -20.0, 115.0, 40.0), hurtPart(20.0, 96.0, 36.0, 125.0, 35.0)]),
      hurtPose(17 + RISE_STARTUP, 23 + RISE_STARTUP, [hurtPart(0.0, 24.0, -32.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
    ],
  oncePerAirtime: true,
  helpless: true,
  landingLag: AIR_LANDING_LAG,
  fallLandingLag: AIR_LANDING_LAG,
};




const IMAGE_STEP_SPEED = f32(-f32(length(f32(1.0)) / 4));
export const IMAGE_STARTUP = 4;
export const MIRROR_IMAGE_OBJECT: SpecialPlacement = { frame: 8 + IMAGE_STARTUP, offsetX: 0.0, radius: 22.0, height: f32(length(f32(1.05))), durability: 1.0, life: 210, fireAges: [] };
const mirrorImage: AuthoredSpecial = {
  endFrame: 24 + IMAGE_STARTUP,
  hurt: [
      hurtPose(1, 8 + IMAGE_STARTUP, [hurtPart(0.0, 24.0, -16.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
      hurtPose(9 + IMAGE_STARTUP, 16 + IMAGE_STARTUP, [hurtPart(0.0, 24.0, -16.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
      hurtPose(17 + IMAGE_STARTUP, 23 + IMAGE_STARTUP, [hurtPart(0.0, 24.0, -32.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
    ],
  facesStick: true,
  placement: MIRROR_IMAGE_OBJECT,
  motion: [
    { ...frames(8 + IMAGE_STARTUP, 11 + IMAGE_STARTUP), velocityX: IMAGE_STEP_SPEED, velocityZ: 0.0 },
    { ...frames(12 + IMAGE_STARTUP, 12 + IMAGE_STARTUP), ...STOP },
  ],
};






const imageSwap: AuthoredSpecial = {
  name: "Image Swap",

  endFrame: 30,
  hurt: [hurtPose(6, 14, LOW_CUT_ARM)],
  motion: [{ ...frames(6, 6), ...STOP, relocate: Relocation.placed }],
  regions: cut(8, [52.0, 45.0, 38.0], L, hit(7.745212554931641, "EDGE", 40)),
};

const inAir = (special: AuthoredSpecial): AuthoredSpecial => ({ ...special, landingLag: AIR_LANDING_LAG });

export const BLADEMASTER_SPECIALS: FighterSpecials = {
  neutral: withExKit({ name: "Wind Cutter", description: "A short blade wave.", ground: windCutter, air: inAir(windCutter) }, { range: 1.25 }),
  side: withExKit({ name: "Wind Walk", description: "Fade into a parry; a strike in the window freezes the attacker and he steps out behind them with a kick straight up. A miss leaves him wide open.", ground: windWalk(false), air: windWalk(true) }, { travel: 1.25 }),
  up: withExKit({ name: "Rising Whirlwind", description: "Hold a direction as he gathers, then a slashing dash that way and a helpless fall.", ground: risingBlade }, { travel: 1.25 }),
  down: withExKit({ name: "Mirror Image", description: "Step back and leave an image; press again to swap to it with a slash. One hit breaks it.", ground: mirrorImage, air: inAir(mirrorImage), recall: imageSwap }, { durability: 2.0 }),
};
