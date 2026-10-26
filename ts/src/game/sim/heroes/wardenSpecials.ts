

import { withExKit } from "../exSpecialAuthoring";
import { f32 } from "wisp/src/sim/f32";
import { HERO_REFERENCE_HEIGHT, heroRegion, type MoveRegion, type StrikeCapsule } from "../heroMoves";
import { CHARGED_AIM_FRAMES, Relocation, frames, type AuthoredSpecial, type FighterSpecials } from "../specials/schema";
import { HeroStatusGroup, HeroStatusKind, HitElement } from "../codes";
import type { AppliedStatus } from "../heroStatus";
import { wardenHit } from "./wardenMoves";

const H = HERO_REFERENCE_HEIGHT;
const KNIFE_RADIUS = 7.0;
const blade = (x1: number, z1: number, x2: number, z2: number, radius = KNIFE_RADIUS): StrikeCapsule => ({ x1, z1, x2, z2, radius });





export const POISON: AppliedStatus = { kind: HeroStatusKind.poison, frames: 180, group: HeroStatusGroup.sleep, immunityFrames: 0, tick: { every: 60, damage: 1.0 } };
const SHADOW_STRIKE: AuthoredSpecial = {
  endFrame: 57,
  projectiles: [{
    model: "Abilities\\Spells\\NightElf\\ShadowStrike\\ShadowStrikeMissile.mdx",
    spawnFrame: 16, offsetX: 30.0, offsetZ: 50.0, velocityX: f32(H * f32(0.11)), velocityZ: 0.0,
    life: 30, radius: f32(H * f32(0.13)), effect: wardenHit(3.8163399696350098, "POKE", 35, 1.0, HitElement.poison), reflectable: true, limit: 1, status: POISON,
  }],
};



const LUNGE_TRAVEL_FRAMES = 10;
const LUNGE_FIRST = 14;
const LUNGE_LAST = LUNGE_FIRST + LUNGE_TRAVEL_FRAMES - 1;
const LUNGE_SPEED = f32(H / f32(LUNGE_TRAVEL_FRAMES));
const LUNGE_STUN_FRAMES = 52;
const PURSUIT_STUN_FRAMES = 40;
const pursuitHit = (stunFrames: number) => ({ ...wardenHit(7.6326799392700195, "POKE", 35), stunFrames });
const LUNGE_PASS_RADIUS = 20.0;
const lungeRegions = (): readonly MoveRegion[] => [
  heroRegion(LUNGE_FIRST + 6, LUNGE_LAST, blade(16.0, 48.0, f32(f32(H * f32(0.80)) - KNIFE_RADIUS), 44.0), pursuitHit(LUNGE_STUN_FRAMES)),
  heroRegion(LUNGE_FIRST, LUNGE_LAST, { x1: 0.0, z1: 48.0, x2: 0.0, z2: 48.0, radius: LUNGE_PASS_RADIUS, path: true }, pursuitHit(LUNGE_STUN_FRAMES)),
];
const PURSUIT_LUNGE: AuthoredSpecial = {
  name: "Pursuit Lunge", endFrame: LUNGE_LAST + 26, regions: lungeRegions(),
  motion: [{ ...frames(LUNGE_FIRST, LUNGE_LAST), velocityX: LUNGE_SPEED, velocityZ: 0.0 }, { ...frames(LUNGE_LAST + 1, LUNGE_LAST + 1), velocityX: 0.0, velocityZ: 0.0, facesStruck: true }],
};



const PURSUIT_REACH = f32(H * f32(2.5));
const SHADOW_PURSUIT: AuthoredSpecial = {
  endFrame: 40,
  motion: [{ ...frames(15, 15), velocityX: 0.0, velocityZ: 0.0, relocate: Relocation.behindMark, relocateReach: PURSUIT_REACH }],
  regions: [heroRegion(18, 20, blade(16.0, 48.0, f32(f32(H * f32(0.80)) - KNIFE_RADIUS), 44.0), pursuitHit(PURSUIT_STUN_FRAMES))],
};


const LUNGE_TILT = { x: f32(0.939692621), z: f32(0.342020143) };
const PURSUIT_LUNGE_AIR: AuthoredSpecial = {
  ...PURSUIT_LUNGE, oncePerAirtime: true, helpless: true, landingLag: 12, aimFrames: 4,
  motion: [{ ...frames(LUNGE_FIRST, LUNGE_LAST), velocityX: LUNGE_SPEED, velocityZ: 0.0, aimedTilt: LUNGE_TILT }, { ...frames(LUNGE_LAST + 1, LUNGE_LAST + 1), velocityX: 0.0, velocityZ: 0.0, facesStruck: true }],
};





const blink = (distance: number): AuthoredSpecial => ({
  endFrame: 30, oncePerAirtime: true, helpless: true, aimFrames: CHARGED_AIM_FRAMES,
  motion: [
    { ...frames(1, CHARGED_AIM_FRAMES), velocityX: 0.0, velocityZ: 0.0 },
    { ...frames(9, 9), velocityX: 0.0, velocityZ: distance, aimedSpeed: distance, throughEdge: true },
    { ...frames(10, 30), velocityX: 0.0, velocityZ: 0.0 },
  ],
  intangible: frames(8, 10),
});
const BLINK = blink(f32(H * f32(3.5)));


const FAN_FRAMES = 27;
const FAN_JUMP_CANCEL = 4;
const FAN_GROUND_HIT = { damage: f32(6.1061435), growth: 100.0, base: 0.0, launchX: f32(0.965925826), launchZ: f32(0.258819045), electric: false, element: HitElement.slash, setKnockback: 60.0 };
const FAN_AIR_HIT = { damage: 5.0, growth: 100.0, base: 0.0, launchX: 1.0, launchZ: 0.0, electric: false, element: HitElement.slash, setKnockback: 80.0 };
const FAN_KNIVES = blade(48.0, 56.0, 92.0, 56.0, 24.0);
const fanRing = (effect: Parameters<typeof heroRegion>[3]): readonly MoveRegion[] => [
  heroRegion(4, 7, FAN_KNIVES, effect),
  heroRegion(4, 7, { ...FAN_KNIVES, x1: -FAN_KNIVES.x2, x2: -FAN_KNIVES.x1 }, { ...effect, launchX: -effect.launchX }),
];
const FAN_OF_KNIVES: AuthoredSpecial = {
  endFrame: FAN_FRAMES, regions: fanRing(FAN_GROUND_HIT), strikeStatus: POISON, jumpCancelFrame: FAN_JUMP_CANCEL, facesStick: true, turnsAround: true,
};
const FAN_OF_KNIVES_AIR: AuthoredSpecial = {
  ...FAN_OF_KNIVES, regions: fanRing(FAN_AIR_HIT),
  airStall: frames(1, FAN_FRAMES),
};

export const WARDEN_SPECIALS: FighterSpecials = {
  neutral: withExKit({ name: "Shadow Strike", description: "A slow dagger that marks and poisons its target.", ground: SHADOW_STRIKE }, { damage: 1.25 }),
  side: withExKit({ name: "Shadow Pursuit", description: "Appear behind a marked opponent and slash; with no mark nearby, a Pursuit Lunge that cuts through them and turns to face them. Either hit stuns in place for a grab or Fan of Knives; a second stun within two seconds only knocks them away.", ground: PURSUIT_LUNGE, air: PURSUIT_LUNGE_AIR, marked: { special: SHADOW_PURSUIT, range: PURSUIT_REACH } }, { damage: 1.25 }),
  up: withExKit({ name: "Blink", description: "Teleport in any of eight directions; the landing spot is open to a punish.", ground: BLINK }, { travel: 1.25 }),
  down: withExKit({ name: "Fan of Knives", description: "A ring of knives on frames 4-7 that hits foes on either side of her, marking and poisoning them; on the ground it pushes them away along a low angle with the same knockback at every percent, never knocking them down, and in the air it sends them away from her on a set semi-spike, like a shine, and nearly stops her fall; jump out of it from frame 4. Hold the stick away as you press it, or on any later frame, to turn around without restarting it.", ground: FAN_OF_KNIVES, air: FAN_OF_KNIVES_AIR }, { damage: 1.25 }),
};
