import { withExKit } from "../../sim/exSpecialAuthoring";
import { f32 } from "wisp/src/sim/f32";
import { hurtCapsule } from "../../sim/geometry/contactGeometry";
import { Character, HitElement } from "../../sim/codes";
import { HERO_REFERENCE_HEIGHT, type MoveRegion, type StrikeCapsule, heroRegion } from "../../sim/heroMoves";
import { hurtPart, hurtPose } from "../../sim/hurtboxes";
import { type AuthoredSpecial, type FighterSpecials, type SpecialMotion, type SpecialProjectile, type SpecialFollowUp, CHARGED_AIM_FRAMES, FollowUpInput, chargedAngleMotion, frames } from "../../sim/specials/schema";
import { SHORT, capsule, hit } from "./moves";




const H = HERO_REFERENCE_HEIGHT;
const heights = (amount: number) => f32(H * f32(amount));




export const BOLT_SPEED = heights(f32(0.102));
const BOLT_RADIUS = heights(f32(0.18));
const STORM_BOLT = hit(5.403449535369873, "LAUNCH", 65, false, HitElement.electric);


const RUSH_FRAMES = 6;
const RUSH_SPEED = f32(heights(f32(1.2)) / RUSH_FRAMES);
const STORM_RUSH = { ...hit(12.968278884887695, "EDGE", 35), growth: f32(88.4) };
const RUSH: readonly SpecialMotion[] = [{ ...frames(13, 18), velocityX: RUSH_SPEED, velocityZ: 0.0, stopsAtBody: true }, { ...frames(19, 19), velocityX: 0.0, velocityZ: 0.0 }];
const RUSH_BODY = capsule(0.0, 14.0, 12.0, 60.0, 26.0);

const RUSH_HURT = [hurtPose(13, 18, [hurtCapsule(Character.mountainKing), hurtPart(RUSH_BODY.x1, RUSH_BODY.z1, RUSH_BODY.x2, RUSH_BODY.z2, RUSH_BODY.radius)])];





const LEAP_DELAY = 2;
const leap = (distance: number): readonly SpecialMotion[] => chargedAngleMotion(distance, 16).map((segment, index) =>
  index === 0 ? { ...segment, last: segment.last + LEAP_DELAY } : { ...segment, first: segment.first + LEAP_DELAY, last: segment.last + LEAP_DELAY });
const FULL_LEAP = leap(heights(f32(2.7)));
const THUNDER_LEAP = hit(8.645519256591797, "LAUNCH", 80, false, HitElement.electric);
const LEAP_HAMMER = capsule(26.0, 41.0, 110.0, -5.0, 16.0);





const PLUNGE = heights(f32(0.16));
const HAMMERFALL_DAMAGE = 12.968278884887695;
const HAMMERFALL_GROUNDED = hit(10.806899070739746, "LAUNCH", 55, false, HitElement.electric);
const HAMMERFALL_HAMMER = capsule(4.0, 10.0, 4.0, -24.0, 20.0);
export const HAMMERFALL_LANDING_LAG = 24;
export const THUNDER_LEAP_LANDING_LAG = 11;
const HAMMERFALL: AuthoredSpecial = {
  name: "Hammerfall",

  endFrame: 70,
  motion: [{ ...frames(1, 3), velocityX: 0.0, velocityZ: 0.0 }, { ...frames(4, 70), velocityX: 0.0, velocityZ: -PLUNGE }],
  regions: [heroRegion(4, 70, HAMMERFALL_HAMMER, hit(HAMMERFALL_DAMAGE, "SPIKE", 270, false, HitElement.electric), HAMMERFALL_GROUNDED)],
  landingLag: HAMMERFALL_LANDING_LAG,
  helpless: true,
};

const DIAGONAL = f32(0.7071067811865476);
const DIVE_PIVOT = 45.0;
export const THUNDER_LEAP_DIVE_FRAME = 27;
const DIVE_WINDOW = frames(THUNDER_LEAP_DIVE_FRAME, THUNDER_LEAP_DIVE_FRAME);
const DIVE_LAST = 15;
const DIVE_END = 33;
const diveHammer = (aimX: number, aimZ: number): StrikeCapsule => {
  const turn = (x: number, z: number): { readonly x: number; readonly z: number } => ({
    x: f32(f32(f32(-aimZ) * x) - f32(aimX * f32(z - DIVE_PIVOT))),
    z: f32(DIVE_PIVOT + f32(f32(aimX * x) + f32(f32(-aimZ) * f32(z - DIVE_PIVOT)))),
  });
  const near = turn(HAMMERFALL_HAMMER.x1, HAMMERFALL_HAMMER.z1);
  const far = turn(HAMMERFALL_HAMMER.x2, HAMMERFALL_HAMMER.z2);
  return capsule(near.x, near.z, far.x, far.z, HAMMERFALL_HAMMER.radius);
};
const dive = (aimX: number, aimZ: number, angle: Parameters<typeof hit>[2], last: number, endFrame: number): AuthoredSpecial => ({
  ...HAMMERFALL,
  endFrame,
  motion: [{ ...frames(1, 3), velocityX: 0.0, velocityZ: 0.0 },
    { ...frames(4, last), velocityX: f32(aimX * PLUNGE), velocityZ: f32(aimZ * PLUNGE) },
    { ...frames(last + 1, last + 1), velocityX: 0.0, velocityZ: 0.0 }],
  regions: [heroRegion(4, last, diveHammer(aimX, aimZ), hit(HAMMERFALL_DAMAGE, aimZ < 0 ? "SPIKE" : "LAUNCH", angle, false, HitElement.electric), HAMMERFALL_GROUNDED)],
});
const diveBranch = (x: number, z: number, special: AuthoredSpecial): SpecialFollowUp => ({ window: DIVE_WINDOW, input: FollowUpInput.auto, stick: { x, z }, special });
const HAMMERFALL_DIVES: readonly SpecialFollowUp[] = [
  diveBranch(0, 1, dive(0.0, 1.0, 85, DIVE_LAST, DIVE_END)),
  diveBranch(1, 1, dive(DIAGONAL, DIAGONAL, 50, DIVE_LAST, DIVE_END)),
  diveBranch(1, 0, dive(1.0, 0.0, 35, DIVE_LAST, DIVE_END)),
  diveBranch(1, -1, dive(DIAGONAL, -DIAGONAL, 270, HAMMERFALL.endFrame, HAMMERFALL.endFrame)),
  diveBranch(0, -1, HAMMERFALL),
];







export const CLAP_REACH = heights(f32(0.7225));
export const CLAP_RADIUS = f32(13.6);
const WAVE_ART_RADIUS = 16.0;
const ring = (first: number, damage: number): readonly MoveRegion[] => [
  heroRegion(first, first + 3, capsule(0.0, 14.0, f32(CLAP_REACH - CLAP_RADIUS), 14.0, CLAP_RADIUS), hit(damage, "LAUNCH", 70, false, HitElement.electric)),
  heroRegion(first, first + 3, capsule(0.0, 14.0, -f32(CLAP_REACH - CLAP_RADIUS), 14.0, CLAP_RADIUS), hit(damage, "LAUNCH", 70, true, HitElement.electric)),
];
const WAVE_SPEED = heights(f32(0.085));
const wave = (spawnFrame: number, sign: number): SpecialProjectile => ({
  model: "Abilities\\Spells\\Orc\\Shockwave\\ShockwaveMissile.mdx",
  spawnFrame, offsetX: f32(sign * CLAP_REACH), offsetZ: 14.0, velocityX: f32(sign * WAVE_SPEED), velocityZ: 0.0, activeFrom: 6,
  life: 24, radius: CLAP_RADIUS, modelRadius: WAVE_ART_RADIUS, effect: hit(7.5648298263549805, "LAUNCH", 75, false, HitElement.electric), reflectable: true, limit: 1,
});
const WAVES = (spawnFrame: number) => [wave(spawnFrame, 1), wave(spawnFrame, -1)];

const CLAP: AuthoredSpecial = { name: "Small Clap", endFrame: 28, regions: ring(4, 9.72620964050293) };

const THUNDER_CLAP: AuthoredSpecial = { endFrame: 32, regions: ring(4, 12.0), projectiles: WAVES(4) };

const HOLD: AuthoredSpecial = { endFrame: 1 };
const CHARGED_CLAP: AuthoredSpecial = {
  endFrame: 78,
  regions: ring(50, 12.0),
  projectiles: WAVES(50),
  followUps: [
    { window: frames(7, 26), special: CLAP },
    { window: frames(27, 46), special: THUNDER_CLAP },
    { window: frames(7, 46), input: FollowUpInput.shield, special: HOLD },
  ],
};

const AIR_CLAP = hit(10.806899070739746, "LAUNCH", 70, false, HitElement.electric);


export const MOUNTAIN_KING_SPECIALS: FighterSpecials = {
  neutral: withExKit({
    name: "Storm Bolt",
    description: "A hammer thrown straight ahead that flies until it hits or its flight ends; it never comes back. Landing before the throw leaves keeps the cast going on the ground.",
    ground: {
      endFrame: 61,
      projectiles: [{
        model: "Abilities\\Spells\\Human\\StormBolt\\StormBoltMissile.mdx",
        spawnFrame: 23, offsetX: 32.0, offsetZ: 56.0, velocityX: BOLT_SPEED, velocityZ: 0.0,
        life: 90, radius: BOLT_RADIUS, effect: STORM_BOLT, reflectable: true, limit: 1,
      }],
      landingLag: 20, swingsThroughLanding: true,
    },
  }, { range: 1.25 }),
  side: withExKit({
    name: "Storm Rush",
    description: "A shoulder charge that stops dead at a body or shield.",
    ground: {
      endFrame: 46,
      regions: [heroRegion(13, 18, RUSH_BODY, STORM_RUSH)],
      hurt: RUSH_HURT,
      motion: RUSH,
    },
    air: {
      endFrame: 46,
      regions: [heroRegion(13, 18, RUSH_BODY, STORM_RUSH)],
      hurt: RUSH_HURT,
      motion: RUSH,
      oncePerAirtime: true,
      helpless: true,
    },
  }, { shieldSafe: true }),
  up: withExKit({
    name: "Thunder Leap",
    description: "Hold a direction as he crouches, then a hammer leap that way; hit or miss, change direction at the top and he dives hammer first that way on his own as Hammerfall, in any of the eight directions other than the one he leapt. Keep the stick where it was, or let it go, and he falls helpless instead.",
    ground: {
      endFrame: 30,
      regions: [heroRegion(11, 16, LEAP_HAMMER, THUNDER_LEAP)],
      aimFrames: CHARGED_AIM_FRAMES,
      motion: FULL_LEAP,
      facesStick: true,
      oncePerAirtime: true,
      helpless: true,
      landingLag: THUNDER_LEAP_LANDING_LAG,
      fallLandingLag: THUNDER_LEAP_LANDING_LAG,
      followUps: HAMMERFALL_DIVES,
    },

  }, { travel: 1.25 }),
  down: withExKit({
    name: "Thunder Clap",
    description: "Raise the hammer and slam: early for a small clap, late for a ring with shockwaves. Shield drops the charge.",
    ground: CHARGED_CLAP,
    air: {
      endFrame: 50,
      regions: [heroRegion(15, 18, capsule(10.0, 10.0, f32(SHORT - 14.0), -20.0, 14.0), AIR_CLAP)],
      landingLag: 20,
    },
  }, { reach: 1.25 }),
};
