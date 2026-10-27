


import { withExKit } from "../../sim/exSpecialAuthoring";
import { f32 } from "wisp/src/sim/f32";
import { HeroStatusGroup, HeroStatusKind, HitElement } from "../../sim/codes";
import { HERO_REFERENCE_HEIGHT, type StrikeCapsule, heroRegion } from "../../sim/heroMoves";
import { type AuthoredSpecial, type FighterSpecials, frames } from "../../sim/specials/schema";
import { hurtPart, hurtPose } from "../../sim/hurtboxes";
import { DREADLORD_STAND, dreadlordHit, dreadlordLimbPoses } from "./moves";

const h = (multiple: number): number => f32(HERO_REFERENCE_HEIGHT * f32(multiple));
const perFrame = (distance: number, frameCount: number): number => f32(distance / frameCount);

const AIR_LANDING_LAG = 20;


const REAR_FOOT = hurtPart(-30.0, 25.0, -44.0, 26.0, 15.0);
const castBody = (endFrame: number) => [hurtPose(1, endFrame, [...DREADLORD_STAND, REAR_FOOT])];

const CARRION_SWARM: AuthoredSpecial = {
  endFrame: 45,
  hurt: castBody(45),
  projectiles: [{
    model: "Abilities\\Spells\\Undead\\CarrionSwarm\\CarrionSwarmMissile.mdx",
    spawnFrame: 20, offsetX: 40.0, offsetZ: 60.0, velocityX: h(f32(0.09)), velocityZ: 0.0, life: 32, radius: h(f32(0.25)),
    effect: dreadlordHit(7.893868446350098, "POKE", 40, 1.0, HitElement.dark), reflectable: true, limit: 1,
  }],
};





const SLEEP_ORB: AuthoredSpecial = {
  endFrame: 58,
  hurt: castBody(58),
  projectiles: [{
    model: "Abilities\\Weapons\\VoidWalkerMissile\\VoidWalkerMissile.mdx",
    spawnFrame: 26, offsetX: 40.0, offsetZ: 60.0, velocityX: h(f32(0.06)), velocityZ: 0.0, life: 50, radius: h(f32(0.18)),
    effect: { damage: 1.8100000619888306, growth: 0.0, base: 0.0, launchX: 0.0, launchZ: 0.0, electric: false, element: HitElement.dark },
    reflectable: true, limit: 1,
    status: { kind: HeroStatusKind.sleep, frames: 160, airFrames: 24, group: HeroStatusGroup.sleep, immunityFrames: 240 },
  }],
};



const POUNCE_GRAB: StrikeCapsule = { x1: 14.0, z1: 40.0, x2: f32(h(f32(0.45)) - 12.0), z2: 40.0, radius: 12.0 };
const POUNCE_BITE = { ...dreadlordHit(11.75, "EDGE", 90), growth: 12.0, base: 110.0 };
const POUNCE_BODY = [
  hurtPose(7, 9, [hurtPart(8.0, 60.0, 8.0, 60.0, 45.0), hurtPart(18.0, 132.0, 18.0, 132.0, 45.0), hurtPart(40.0, 182.0, 40.0, 182.0, 21.0), hurtPart(8.0, 60.0, 18.0, 132.0, 8.0), hurtPart(18.0, 132.0, 40.0, 182.0, 8.0)]),
  hurtPose(10, 12, [hurtPart(9.0, 48.0, 9.0, 48.0, 45.0), hurtPart(20.0, 120.0, 20.0, 120.0, 45.0), hurtPart(35.0, 175.0, 35.0, 175.0, 21.0), hurtPart(9.0, 48.0, 20.0, 120.0, 8.0), hurtPart(20.0, 120.0, 35.0, 175.0, 8.0)]),
  ...dreadlordLimbPoses([heroRegion(17, 19, POUNCE_GRAB, POUNCE_BITE)], 53, 1),
];
const NIGHT_POUNCE: AuthoredSpecial = {
  endFrame: 53,
  motion: [{ ...frames(1, 16), velocityX: h(f32(0.14)), velocityZ: 0.0, stopsAtBody: true }, { ...frames(17, 17), velocityX: 0.0, velocityZ: 0.0 }],
  commandGrab: { ...frames(1, 19), strike: POUNCE_GRAB, holdFrames: 4, effect: POUNCE_BITE, recovery: 8, heal: { heal: 4.0 } },
  hurt: POUNCE_BODY,
};
const NIGHT_POUNCE_AIR: AuthoredSpecial = {
  ...NIGHT_POUNCE,
  oncePerAirtime: true,
  helpless: true,
  landingLag: AIR_LANDING_LAG,
};




const SPREAD_WINGS = [hurtPose(9, 32, [
  ...DREADLORD_STAND,
  hurtPart(-14.0, 85.0, -60.0, 125.0, 16.0),
  hurtPart(14.0, 85.0, 44.0, 125.0, 14.0),
  REAR_FOOT,
])];
function batAscension(rise: number, across: number): AuthoredSpecial {
  return {
    endFrame: 32,
    motion: [{ ...frames(9, 32), velocityX: 0.0, velocityZ: perFrame(h(rise), 24), driftSpeed: perFrame(h(across), 24) }],
    oncePerAirtime: true,
    helpless: true,
    hurt: SPREAD_WINGS,
  };
}

export const DREADLORD_SPECIALS: FighterSpecials = {
  neutral: withExKit({ name: "Carrion Swarm", description: "A short, slow cloud of bats.", ground: CARRION_SWARM, air: { ...CARRION_SWARM, landingLag: AIR_LANDING_LAG } }, { reach: 1.25 }),
  side: withExKit({ name: "Vampiric Pounce", description: "Corkscrew forward with trailing bats; bite and heal on a catch, recover on a miss.", ground: NIGHT_POUNCE, air: NIGHT_POUNCE_AIR }, { damage: 1.25 }),
  up: withExKit({ name: "Bat Ascension", description: "A steerable rise on bat wings, then a helpless fall.", ground: batAscension(f32(3.3), f32(2.2)) }, { travel: 1.25 }),
  down: withExKit({ name: "Sleep", description: "A slow orb that puts a grounded target to sleep until it mashes out or is hit.", ground: SLEEP_ORB, air: { ...SLEEP_ORB, landingLag: AIR_LANDING_LAG } }, { reach: 1.25 }),
};
