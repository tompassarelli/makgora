import { f32 } from "wisp/src/sim/f32";
import { heroRegion } from "../../sim/heroMoves";
import { frames, type AuthoredSpecial, type FighterSpecials, type SpecialProjectile } from "../../sim/specials/schema";
import { hurtPart } from "../../sim/hurtboxes";
import { NO_LAUNCH, cairneCapsule as c, cairneHit as hit, cairneHurtPose } from "./moves";

const shockwave = (air: boolean): AuthoredSpecial => ({
  endFrame: 61, landingLag: air ? 24 : undefined,
  projectiles: [{ spawnFrame: 24, offsetX: 72.0, offsetZ: 36.0, velocityX: 13.0, velocityZ: 0.0,
    life: 38, radius: 20.0, effect: hit(7.5, "edge", 35), reflectable: true, limit: 1,
    modelRadius: f32(320.0 / 17.0), modelOffsetZ: -22.0, model: "Abilities\\Spells\\Orc\\Shockwave\\ShockwaveMissile.mdx" }],
});
const GORE_HORNS = cairneHurtPose(8, 25, hurtPart(30.0, 80.0, 75.0, 70.0, 22.0));
const gore = (air: boolean): AuthoredSpecial => ({
  endFrame: 60, hurt: GORE_HORNS,
  motion: [{ ...frames(12, 25), velocityX: air ? 8.0 : 10.0, velocityZ: 0.0, stopsAtBody: true }, { ...frames(26, 26), velocityX: 0.0, velocityZ: 0.0 }],
  commandGrab: { ...frames(12, 24), strike: c(40.0, 62.0, 100.0, 48.0, 24.0), holdFrames: 20, effect: hit(10.763999938964844, "kill", 40), recovery: 22 },
  ...(air ? { oncePerAirtime: true, helpless: true, landingLag: 24 } : {}),
});
const STOMP_RING: SpecialProjectile = {
  model: "Abilities\\Spells\\Orc\\WarStomp\\WarStompCaster.mdx", spawnFrame: 20, offsetX: 0.0, offsetZ: 0.0, velocityX: 0.0, velocityZ: 0.0,
  life: 24, radius: 1.0, modelRadius: f32(1.0 / f32(f32(2.0 * 130.0) / 340.0)), activeFrom: 25,
  effect: { damage: 0.0, ...NO_LAUNCH }, reflectable: false, limit: 1,
};
const WAR_STOMP: AuthoredSpecial = {
  endFrame: 62, defensiveUse: true, armor: { ...frames(1, 19), knockback: 100.0 },
  regions: [heroRegion(20, 23, c(0.0, 16.0, 106.0, 16.0, 24.0), hit(9.75, "launch", 80)),
    heroRegion(20, 23, c(0.0, 16.0, -106.0, 16.0, 24.0), hit(9.75, "launch", 80, -1)),
    heroRegion(20, 21, c(-50.0, 60.0, 50.0, 60.0, 34.0), hit(9.75, "launch", 85))],
  projectiles: [STOMP_RING],
};
const lift = (): AuthoredSpecial => ({
  endFrame: 32, oncePerAirtime: true, helpless: true, facesStick: true,
  motion: [{ ...frames(1, 10), velocityX: 0.0, velocityZ: 0.0 },
    { ...frames(11, 26), velocityX: 0.0, velocityZ: 20.0, driftSpeed: 10.0 },
    { ...frames(27, 32), velocityX: 0.0, velocityZ: 6.0, driftSpeed: 3.0 }],
  regions: [heroRegion(11, 11, c(-55.0, 183.0, -102.0, 217.0, 20.0), hit(7.250796318054199, "launch", 80)),
    heroRegion(12, 16, c(-19.0, 169.0, -53.0, 200.0, 20.0), hit(7.250796318054199, "launch", 80))],
});

export const CAIRNE_SPECIALS: FighterSpecials = {
  neutral: { name: "Shockwave", description: "Plant the halberd and send one low wave along the ground.", ground: shockwave(false), air: shockwave(true) },
  side: { name: "Bloodhoof Gore", description: "Paw the ground, then charge with lowered horns; a catch hoists the foe through any shield and flings it away.", ground: gore(false), air: gore(true) },
  up: { name: "Spirit Lift", description: "Rise behind the halberd, then fall helplessly with exposed sides.", ground: lift() },
  down: { name: "War Stomp", description: "Endurance armor shrugs off light hits without flinching until the stomp, then pops nearby foes straight up; heavy hits break through, and the long recovery is punishable.",
    ground: WAR_STOMP, air: { ...WAR_STOMP, landingLag: 26 } },
};
