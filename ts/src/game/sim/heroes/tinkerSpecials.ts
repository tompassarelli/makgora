import { f32 } from "wisp/src/sim/f32";
import { withExKit } from "../exSpecialAuthoring";
import { HitElement } from "../codes";
import { heroRegion, type MoveRegion } from "../heroMoves";
import { frames, type AuthoredSpecial, type FighterSpecials, type SpecialProjectile } from "../heroSpecials";
import { claw, tinkerHit } from "./tinkerMoves";

const rocket = (spawnFrame: number): SpecialProjectile => ({
  model: "Abilities\\Weapons\\RocketMissile\\RocketMissile.mdl",
  spawnFrame, offsetX: 35.0, offsetZ: 45.0, velocityX: 10.0, velocityZ: 2.0,
  gravity: f32(0.12), life: 44, radius: 15.0, effect: tinkerHit(3.427246570587158, "poke", 55, 1.0, HitElement.fire),
  reflectable: true, limit: 3,
});
const rockets = (air: boolean): AuthoredSpecial => ({ endFrame: 43, projectiles: [rocket(14), rocket(20), rocket(26)], landingLag: air ? 20 : undefined });
const boots = (rise: number, drift: number): AuthoredSpecial => ({
  endFrame: 32, motion: [{ ...frames(1, 6), velocityX: 0.0, velocityZ: 0.0 }, { ...frames(7, 29), velocityX: 0.0, velocityZ: rise, driftSpeed: drift }],
  oncePerAirtime: true, helpless: true, facesStick: true,
  regions: [heroRegion(7, 10, claw(0.0, 10.0, 0.0, 90.0, 26.0), tinkerHit(4.284058094024658, "juggle", 85, 1.0, HitElement.fire))],
});
const LASER_ORIGIN_X = 30.0;
const LASER_ORIGIN_Z = 50.0;
const LASER_RANGE = 360.0;
const LASER_RADIUS = 14.0;
const laserRegion = (): MoveRegion => {
  const region = heroRegion(20, 27, claw(LASER_ORIGIN_X, LASER_ORIGIN_Z, LASER_ORIGIN_X + LASER_RANGE, LASER_ORIGIN_Z, LASER_RADIUS), tinkerHit(6.854493141174316, "launch", 70, 1.0, HitElement.fire));
  return { ...region, hit: { ...region.hit, minZ: LASER_ORIGIN_Z - LASER_RANGE - LASER_RADIUS, maxZ: LASER_ORIGIN_Z + LASER_RANGE + LASER_RADIUS } };
};
const laser = (air: boolean): AuthoredSpecial => ({
  endFrame: 54, beam: { originX: LASER_ORIGIN_X, originZ: LASER_ORIGIN_Z, range: LASER_RANGE, track: 11.0 },
  regions: [laserRegion()], landingLag: air ? 20 : undefined,
});
const clockwerk = (velocityZ: number, gravity?: number): SpecialProjectile => ({
  model: "Units\\Creeps\\HeroTinkerRobot\\HeroTinkerRobot.mdl",
  spawnFrame: 0, offsetX: 20.0, offsetZ: 16.0, velocityX: 7.0, velocityZ, gravity,
  life: 44, radius: 18.0, effect: tinkerHit(5.140870094299316, "poke", 35, 1.0, HitElement.fire), reflectable: true, limit: 3,
});
const goblinDrop: SpecialProjectile = { ...clockwerk(-3.0, f32(0.25)), spawnFrame: 10, velocityX: 3.0, life: 40 };

export const TINKER_SPECIALS: FighterSpecials = {
  neutral: withExKit({ name: "Cluster Rockets", description: "Three rockets cover the approach and charge the next claw hit.", ground: rockets(false), air: rockets(true) }, { damage: 1.25 }),
  side: withExKit({
    name: "Laser", description: "His mechanical arms glow with laser light, then a beam tracks the nearest foe in front of him; shield it on reaction and punish the end lag.",
    ground: laser(false), air: laser(true),
  }, { damage: 1.25, reach: 1.25 }),
  up: withExKit({ name: "Rocket Boots", description: "Blast off, burn upward and steer left or right, then fall helplessly.", ground: boots(18.0, 7.0) }, { travel: 1.25 }),
  down: withExKit({
    name: "Pocket Factory", description: "Build a breakable factory that sends out Clockwerk Goblins; press again to recall it. In the air he drops one goblin.",
    ground: { endFrame: 48, groundOnly: true, placement: {
      frame: 24, offsetX: 88.0, radius: 24.0, height: 65.0, durability: 24.0, life: 240,
      fireAges: [35, 80, 125, 170, 215], shot: clockwerk(0.0),
    } },
    air: { endFrame: 36, projectiles: [goblinDrop], landingLag: 16 },
    recall: { endFrame: 36, groundOnly: true, recall: true },
  }, { damage: 1.25, durability: 1.25, recallProtection: 4 }),
};
