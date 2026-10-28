

import { withExKit } from "../../sim/exSpecialAuthoring";
import { f32 } from "wisp/src/sim/f32";
import { HERO_REFERENCE_HEIGHT, heroRegion, type MoveRegion, type StrikeCapsule } from "../../sim/heroMoves";
import { ILLUSION_AIR_LANDING_LAG, ILLUSION_DISTANCE_HEIGHTS, ILLUSION_END_FRAME, ILLUSION_FIRST_TRAVEL_FRAME, ILLUSION_HIT_RECOVERY, ILLUSION_LAST_TRAVEL_FRAME, ILLUSION_SHORTEN, ILLUSION_TRAVEL_FRAMES } from "../../sim/specials/illusionDash";
import { CHARGED_AIM_FRAMES, frames, type AuthoredSpecial, type FighterSpecials } from "../../sim/specials/schema";
import { HeroStatusGroup, HeroStatusKind, HitElement } from "../../sim/codes";
import type { AppliedStatus } from "../../sim/heroStatus";
import { wardenHit } from "./moves";

const H = HERO_REFERENCE_HEIGHT;
const KNIFE_RADIUS = 7.0;
const blade = (x1: number, z1: number, x2: number, z2: number, radius = KNIFE_RADIUS): StrikeCapsule => ({ x1, z1, x2, z2, radius });





export const POISON: AppliedStatus = { kind: HeroStatusKind.poison, frames: 180, group: HeroStatusGroup.sleep, immunityFrames: 0, tick: { every: 60, damage: 1.0 } };
const SHADOW_STRIKE_SPAWN_FRAME = 10;
const SHADOW_STRIKE_FRAMES = 36;
const SHADOW_STRIKE_REFIRE = frames(4, 13);
const SHADOW_STRIKE: AuthoredSpecial = {
  endFrame: SHADOW_STRIKE_FRAMES, refire: SHADOW_STRIKE_REFIRE,
  projectiles: [{
    model: "Abilities\\Spells\\NightElf\\ShadowStrike\\ShadowStrikeMissile.mdx",
    spawnFrame: SHADOW_STRIKE_SPAWN_FRAME, offsetX: 30.0, offsetZ: 50.0, velocityX: f32(H * f32(0.11)), velocityZ: 0.0,
    life: 30, radius: f32(H * f32(0.13)), effect: wardenHit(3.8163399696350098, "POKE", 35, 1.0, HitElement.poison), reflectable: true, limit: 3, status: POISON,
  }],
};
const SHADOW_STRIKE_AIR: AuthoredSpecial = { ...SHADOW_STRIKE, landingLag: 0 };



const ILLUSION_LAUNCH = { x: f32(0.173648178), z: f32(0.984807753) };
const illusionHit = (growth: number) => ({ damage: 7.0, growth, base: 74.0, launchX: ILLUSION_LAUNCH.x, launchZ: ILLUSION_LAUNCH.z, electric: false, element: HitElement.slash });
const ILLUSION_PATH_Z = 48.0;
const ILLUSION_PATH_RADIUS = 24.0;
export const SHADOW_DASH_DISTANCE = f32(H * f32(ILLUSION_DISTANCE_HEIGHTS));
const shadowDash = (growth: number): AuthoredSpecial => ({
  endFrame: ILLUSION_END_FRAME, shorten: ILLUSION_SHORTEN,
  hitRecovery: { from: ILLUSION_LAST_TRAVEL_FRAME + 1, frames: ILLUSION_HIT_RECOVERY },
  motion: [
    { ...frames(1, ILLUSION_FIRST_TRAVEL_FRAME - 1), velocityX: 0.0, velocityZ: 0.0 },
    { ...frames(ILLUSION_FIRST_TRAVEL_FRAME, ILLUSION_LAST_TRAVEL_FRAME), velocityX: f32(SHADOW_DASH_DISTANCE / f32(ILLUSION_TRAVEL_FRAMES)), velocityZ: 0.0 },
    { ...frames(ILLUSION_LAST_TRAVEL_FRAME + 1, ILLUSION_LAST_TRAVEL_FRAME + 1), velocityX: 0.0, velocityZ: 0.0 },
  ],
  regions: [heroRegion(ILLUSION_FIRST_TRAVEL_FRAME, ILLUSION_LAST_TRAVEL_FRAME, { x1: 0.0, z1: ILLUSION_PATH_Z, x2: 0.0, z2: ILLUSION_PATH_Z, radius: ILLUSION_PATH_RADIUS, path: true }, illusionHit(growth))],
});
const SHADOW_DASH = shadowDash(40.0);
const SHADOW_DASH_AIR: AuthoredSpecial = {
  ...shadowDash(60.0), oncePerAirtime: true, helpless: true, landingLag: ILLUSION_AIR_LANDING_LAG, airStall: frames(1, ILLUSION_LAST_TRAVEL_FRAME),
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
const FAN_GROUND_HIT = { damage: f32(6.1061435), growth: 100.0, base: 0.0, launchX: f32(0.965925826), launchZ: f32(0.258819045), electric: false, element: HitElement.slash, setKnockback: 80.0 };
const FAN_AIR_HIT = { damage: 5.0, growth: 100.0, base: 0.0, launchX: 1.0, launchZ: 0.0, electric: false, element: HitElement.slash, setKnockback: 80.0 };
const FAN_KNIVES = blade(48.0, 56.0, 92.0, 56.0, 24.0);
const fanRing = (effect: Parameters<typeof heroRegion>[3]): readonly MoveRegion[] => [
  heroRegion(4, 7, FAN_KNIVES, effect),
  heroRegion(4, 7, { ...FAN_KNIVES, x1: -FAN_KNIVES.x2, x2: -FAN_KNIVES.x1 }, { ...effect, launchX: -effect.launchX }),
];
const FAN_OF_KNIVES: AuthoredSpecial = {
  endFrame: FAN_FRAMES, regions: fanRing(FAN_GROUND_HIT), strikeStatus: POISON, jumpCancelFrame: FAN_JUMP_CANCEL, facesStick: true, turnsAround: true, groundMomentum: true,
};
const FAN_OF_KNIVES_AIR: AuthoredSpecial = {
  ...FAN_OF_KNIVES, regions: fanRing(FAN_AIR_HIT),
  airStall: frames(1, FAN_FRAMES),
};

export const WARDEN_SPECIALS: FighterSpecials = {
  neutral: withExKit({ name: "Shadow Strike", description: "A slow dagger that marks and poisons its target; it leaves on frame 10 of 36, on the ground or in the air; press again from frame 4 to throw another 10 frames later, so a short hop throws two, and landing in the air cuts the rest short.", ground: SHADOW_STRIKE, air: SHADOW_STRIKE_AIR }, { range: 1.25 }),
  side: withExKit({ name: "Shadow Dash", description: "A fast straight blink dash that cuts through foes and leaves her afterimages along the path; it travels on frames 21-25 of 63, and pressing special again while she travels stops her where she is, and a shortened dash still hits. The slash pops foes up at 80 degrees with no stun, and a hit cuts her end lag short for a follow-up. In the air it holds her up through the dash, once per airtime, and leaves her helpless.", ground: SHADOW_DASH, air: SHADOW_DASH_AIR }, { travel: 1.25 }),
  up: withExKit({ name: "Blink", description: "Teleport in any of eight directions; the landing spot is open to a punish.", ground: BLINK }, { travel: 1.25 }),
  down: withExKit({ name: "Fan of Knives", description: "A ring of knives on frames 4-7 that hits foes on either side of her, poisoning them; on the ground it pushes them away along a low angle with shine's knockback at every percent, so a light foe tumbles and a heavy one does not, and in the air it sends them away from her on a set semi-spike, like a shine, and nearly stops her fall; jump out of it from frame 4. On the ground she slides on the speed she had, slowing only by traction, and in the air she stops sideways as it starts. Hold the stick away as you press it, or on any later frame, to turn around without restarting it.", ground: FAN_OF_KNIVES, air: FAN_OF_KNIVES_AIR }, { reach: 1.25 }),
};
