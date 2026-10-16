

import { withExKit } from "../exSpecialAuthoring";
import { f32 } from "wisp/src/sim/f32";
import { HERO_REFERENCE_HEIGHT, heroRegion, type MoveRegion, type StrikeCapsule } from "../heroMoves";
import { CHARGED_AIM_FRAMES, Relocation, frames, type AuthoredSpecial, type FighterSpecials, type SpecialKit } from "../specials/schema";
import { HeroStatusGroup, HeroStatusKind, HitElement } from "../codes";
import type { AppliedStatus } from "../heroStatus";
import { wardenHit } from "./wardenMoves";

const H = HERO_REFERENCE_HEIGHT;
const KNIFE_RADIUS = 7.0;
const blade = (x1: number, z1: number, x2: number, z2: number, radius = KNIFE_RADIUS): StrikeCapsule => ({ x1, z1, x2, z2, radius });





const POISON: AppliedStatus = { kind: HeroStatusKind.poison, frames: 180, group: HeroStatusGroup.sleep, immunityFrames: 0, tick: { every: 60, damage: 1.0 } };
const SHADOW_STRIKE: AuthoredSpecial = {
  endFrame: 57,
  projectiles: [{
    model: "Abilities\\Spells\\NightElf\\ShadowStrike\\ShadowStrikeMissile.mdx",
    spawnFrame: 16, offsetX: 30.0, offsetZ: 50.0, velocityX: f32(H * f32(0.11)), velocityZ: 0.0,
    life: 30, radius: f32(H * f32(0.13)), effect: wardenHit(3.8163399696350098, "POKE", 35, 1.0, HitElement.poison), reflectable: true, limit: 1, status: POISON,
  }],
};



const LUNGE_TRAVEL_FRAMES = 10;
const LUNGE_SPEED = f32(H / f32(LUNGE_TRAVEL_FRAMES));
const lungeRegions = (): readonly MoveRegion[] => [heroRegion(11, 14, blade(16.0, 48.0, f32(f32(H * f32(0.80)) - KNIFE_RADIUS), 44.0), wardenHit(7.6326799392700195, "EDGE", 35))];
const PURSUIT_LUNGE: AuthoredSpecial = {
  name: "Pursuit Lunge", endFrame: 40, regions: lungeRegions(),
  motion: [{ ...frames(5, 14), velocityX: LUNGE_SPEED, velocityZ: 0.0 }, { ...frames(15, 15), velocityX: 0.0, velocityZ: 0.0 }],
};



const PURSUIT_REACH = f32(H * f32(2.5));
const SHADOW_PURSUIT: AuthoredSpecial = {
  endFrame: 40,
  motion: [{ ...frames(15, 15), velocityX: 0.0, velocityZ: 0.0, relocate: Relocation.behindMark, relocateReach: PURSUIT_REACH }],
  regions: [heroRegion(18, 20, blade(16.0, 48.0, f32(f32(H * f32(0.80)) - KNIFE_RADIUS), 44.0), wardenHit(7.6326799392700195, "EDGE", 35))],
};


const LUNGE_TILT = { x: f32(0.939692621), z: f32(0.342020143) };
const PURSUIT_LUNGE_AIR: AuthoredSpecial = {
  ...PURSUIT_LUNGE, oncePerAirtime: true, helpless: true, landingLag: 12, aimFrames: 4,
  motion: [{ ...frames(5, 14), velocityX: LUNGE_SPEED, velocityZ: 0.0, aimedTilt: LUNGE_TILT }, { ...frames(15, 15), velocityX: 0.0, velocityZ: 0.0 }],
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


const SHINE_REACH = f32(H * f32(0.7));
const SHINE_CENTER = 48.0;
const SHINE_RADIUS = f32(H * f32(0.3));
const SHINE_FRAMES = 27;
const SHINE_JUMP_CANCEL = 4;
const shineRegions = (scale = 1.0): readonly MoveRegion[] => {
  const reach = f32(f32(SHINE_REACH - SHINE_RADIUS) * scale);
  const radius = f32(SHINE_RADIUS * scale);
  return [
    heroRegion(1, 1, blade(0.0, SHINE_CENTER, reach, SHINE_CENTER, radius), wardenHit(f32(6.1061435), "CHASE", 85)),
    heroRegion(1, 1, blade(0.0, SHINE_CENTER, -reach, SHINE_CENTER, radius), wardenHit(f32(6.1061435), "CHASE", 85, -1.0)),
  ];
};
const FAN_OF_KNIVES: AuthoredSpecial = {
  endFrame: SHINE_FRAMES, regions: shineRegions(), strikeStatus: POISON, intangible: frames(1, 1), jumpCancelFrame: SHINE_JUMP_CANCEL,
};
const FAN_OF_KNIVES_AIR: AuthoredSpecial = { ...FAN_OF_KNIVES, motion: [{ ...frames(1, SHINE_FRAMES), velocityX: 0.0, velocityZ: 0.0 }] };


function withFanEx(kit: SpecialKit): SpecialKit {
  const upgraded = withExKit(kit, { reach: 1.25 });
  const form = (move: AuthoredSpecial): AuthoredSpecial => ({ ...move,
    ex: move.ex === undefined ? undefined : { ...move.ex, regions: shineRegions(1.25) },
  });
  return { ...upgraded, ground: form(upgraded.ground), air: upgraded.air === undefined ? undefined : form(upgraded.air) };
}

export const WARDEN_SPECIALS: FighterSpecials = {
  neutral: withExKit({ name: "Shadow Strike", description: "A slow dagger that marks and poisons its target.", ground: SHADOW_STRIKE }, { damage: 1.25 }),
  side: withExKit({ name: "Shadow Pursuit", description: "Appear behind a marked opponent and slash; with no mark nearby, a dashing Pursuit Lunge.", ground: PURSUIT_LUNGE, air: PURSUIT_LUNGE_AIR, marked: { special: SHADOW_PURSUIT, range: PURSUIT_REACH } }, { damage: 1.25 }),
  up: withExKit({ name: "Blink", description: "Teleport in any of eight directions; the landing spot is open to a punish.", ground: BLINK }, { travel: 1.25 }),
  down: withFanEx({ name: "Fan of Knives", description: "A frame-one knife burst around her that pops foes upward, marking and poisoning them; jump out of it from frame 4, and in the air it holds her in place.", ground: FAN_OF_KNIVES, air: FAN_OF_KNIVES_AIR }),
};
