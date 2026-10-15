import { withExKit } from "../exSpecialAuthoring";
import { f32 } from "wisp/src/sim/f32";
import { heroRegion } from "../heroMoves";
import { frames, type AuthoredSpecial, type FighterSpecials, type SpecialProjectile } from "../heroSpecials";
import { hurtPart } from "../hurtboxes";
import { NO_LAUNCH, cairneCapsule as c, cairneHit as hit, cairneHurtPose } from "./cairneMoves";

const shockwave = (air: boolean): AuthoredSpecial => ({
  endFrame: 58, landingLag: air ? 24 : undefined,
  projectiles: [{ spawnFrame: 24, offsetX: 72.0, offsetZ: 36.0, velocityX: 13.0, velocityZ: 0.0,
    life: 38, radius: 20.0, effect: hit(9.729999542236328, "edge", 35), reflectable: true, limit: 1,
    model: "Abilities\\Spells\\Other\\CrushingWave\\CrushingWaveMissile.mdx" }],
});
const GORE_HORNS = cairneHurtPose(8, 25, hurtPart(30.0, 80.0, 75.0, 70.0, 22.0));
const gore = (air: boolean): AuthoredSpecial => ({
  endFrame: 58, hurt: GORE_HORNS,
  motion: [{ ...frames(12, 25), velocityX: air ? 8.0 : 10.0, velocityZ: 0.0, stopsAtBody: true }, { ...frames(26, 26), velocityX: 0.0, velocityZ: 0.0 }],
  commandGrab: { ...frames(12, 24), strike: c(40.0, 62.0, 100.0, 48.0, 24.0), holdFrames: 20, effect: hit(13.0, "kill", 40), recovery: 22 },
  ...(air ? { oncePerAirtime: true, helpless: true, landingLag: 24 } : {}),
});
const STOMP_RING: SpecialProjectile = {
  model: "Abilities\\Spells\\Orc\\WarStomp\\WarStompCaster.mdx", spawnFrame: 20, offsetX: 0.0, offsetZ: 0.0, velocityX: 0.0, velocityZ: 0.0,
  life: 24, radius: 1.0, modelRadius: f32(1.0 / f32(f32(2.0 * 130.0) / 340.0)), activeFrom: 25,
  effect: { damage: 0.0, ...NO_LAUNCH }, reflectable: false, limit: 1,
};
const WAR_STOMP: AuthoredSpecial = {
  endFrame: 54, defensiveUse: true, armor: { ...frames(6, 19), maxDamage: 8.0 },
  regions: [heroRegion(20, 23, c(0.0, 16.0, 106.0, 16.0, 24.0), hit(12.64900016784668, "launch", 80)),
    heroRegion(20, 23, c(0.0, 16.0, -106.0, 16.0, 24.0), hit(12.64900016784668, "launch", 80, -1)),
    heroRegion(20, 21, c(-50.0, 60.0, 50.0, 60.0, 34.0), hit(12.64900016784668, "launch", 85))],
  projectiles: [STOMP_RING],
};
const lift = (): AuthoredSpecial => ({
  endFrame: 32, oncePerAirtime: true, helpless: true, facesStick: true,
  motion: [{ ...frames(1, 10), velocityX: 0.0, velocityZ: 0.0 },
    { ...frames(11, 26), velocityX: 0.0, velocityZ: 20.0, driftSpeed: 10.0 },
    { ...frames(27, 32), velocityX: 0.0, velocityZ: 6.0, driftSpeed: 3.0 }],
  regions: [heroRegion(11, 16, c(0.0, 95.0, 0.0, 200.0, 20.0), hit(8.756999969482422, "launch", 80))],
});

export const CAIRNE_SPECIALS: FighterSpecials = {
  neutral: withExKit({ name: "Shockwave", description: "Plant the totem and send one low wave along the ground.", ground: shockwave(false), air: shockwave(true) }, { damage: 1.25 }),
  side: withExKit({ name: "Bloodhoof Gore", description: "Paw the ground, then charge with lowered horns; a catch hoists the foe through any shield and flings it away.", ground: gore(false), air: gore(true) }, { damage: 1.25 }),
  up: withExKit({ name: "Spirit Lift", description: "Rise behind the totem, then fall helplessly with exposed sides.", ground: lift() }, { travel: 1.25 }),
  down: withExKit({ name: "War Stomp", description: "Endurance armor shrugs off one light hit, then a stomp around him pops nearby foes straight up.",
    ground: WAR_STOMP, air: { ...WAR_STOMP, landingLag: 26 } }, { armorDamage: 1.5, reach: f32(1.2) }),
};
