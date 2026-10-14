import { heroRegion, heroHurtPose } from "../heroMoves";
import { hurtPart } from "../hurtboxes";
import { CHARGED_AIM_FRAMES, chargedAngleMotion, frames, type AuthoredSpecial, type FighterSpecials } from "../heroSpecials";
import { anubarakHit } from "./anubarakMoves";

const neutral_special_ground_hurt = [
  heroHurtPose(2, 9, [hurtPart(-17.0, 39.0, -17.0, 39.0, 44.0), hurtPart(-6.0, 104.0, -6.0, 104.0, 44.0), hurtPart(-32.0, 118.0, -32.0, 118.0, 42.0)]),
  heroHurtPose(10, 17, [hurtPart(-19.0, 39.0, -19.0, 39.0, 44.0), hurtPart(-7.0, 102.0, -7.0, 102.0, 44.0), hurtPart(-34.0, 116.0, -34.0, 116.0, 44.0)]),
  heroHurtPose(18, 25, [hurtPart(-17.0, 37.0, -17.0, 37.0, 44.0), hurtPart(16.0, 109.0, 16.0, 109.0, 44.0), hurtPart(-7.0, 116.0, -7.0, 116.0, 44.0)]),
  heroHurtPose(26, 33, [hurtPart(-25.0, 38.0, -25.0, 38.0, 44.0), hurtPart(17.0, 109.0, 17.0, 109.0, 44.0), hurtPart(-5.0, 129.0, -5.0, 129.0, 31.0)]),
  heroHurtPose(34, 41, [hurtPart(-18.0, 38.0, -18.0, 38.0, 44.0), hurtPart(10.0, 108.0, 10.0, 108.0, 44.0), hurtPart(-17.0, 127.0, -17.0, 127.0, 33.0)]),
  heroHurtPose(42, 49, [hurtPart(-15.0, 39.0, -15.0, 39.0, 44.0), hurtPart(-6.0, 107.0, -6.0, 107.0, 44.0), hurtPart(-27.0, 121.0, -27.0, 121.0, 39.0)])
];
const down_special_ground_hurt = [
  heroHurtPose(2, 9, [hurtPart(-18.0, 39.0, -18.0, 39.0, 44.0), hurtPart(-5.0, 104.0, -5.0, 104.0, 44.0), hurtPart(-33.0, 118.0, -33.0, 118.0, 42.0)]),
  heroHurtPose(10, 17, [hurtPart(-16.0, 36.0, -16.0, 36.0, 44.0), hurtPart(11.0, 110.0, 11.0, 110.0, 44.0), hurtPart(-9.0, 116.0, -9.0, 116.0, 44.0)]),
  heroHurtPose(18, 25, [hurtPart(-18.0, 36.0, -18.0, 36.0, 44.0), hurtPart(10.0, 110.0, 10.0, 110.0, 44.0), hurtPart(-5.0, 122.0, -5.0, 122.0, 38.0)]),
  heroHurtPose(26, 33, [hurtPart(-16.0, 37.0, -16.0, 37.0, 44.0), hurtPart(12.0, 109.0, 12.0, 109.0, 44.0), hurtPart(-13.0, 122.0, -13.0, 122.0, 38.0)]),
  heroHurtPose(34, 41, [hurtPart(-13.0, 36.0, -13.0, 36.0, 44.0), hurtPart(4.0, 107.0, 4.0, 107.0, 44.0), hurtPart(-23.0, 123.0, -23.0, 123.0, 37.0)]),
  heroHurtPose(42, 47, [hurtPart(-19.0, 36.0, -19.0, 36.0, 44.0), hurtPart(-10.0, 104.0, -10.0, 104.0, 44.0), hurtPart(-29.0, 123.0, -29.0, 123.0, 37.0)])
];
const neutral_special_air_hurt = [
  heroHurtPose(2, 9, [hurtPart(-19.0, 36.0, -19.0, 36.0, 44.0), hurtPart(-6.0, 102.0, -6.0, 102.0, 44.0), hurtPart(-32.0, 118.0, -32.0, 118.0, 42.0)]),
  heroHurtPose(10, 17, [hurtPart(-20.0, 37.0, -20.0, 37.0, 44.0), hurtPart(-16.0, 116.0, -16.0, 116.0, 44.0)]),
  heroHurtPose(18, 25, [hurtPart(-19.0, 27.0, -19.0, 27.0, 44.0), hurtPart(15.0, 102.0, 15.0, 102.0, 44.0), hurtPart(-6.0, 116.0, -6.0, 116.0, 44.0)]),
  heroHurtPose(26, 33, [hurtPart(-23.0, 28.0, -23.0, 28.0, 44.0), hurtPart(16.0, 103.0, 16.0, 103.0, 44.0), hurtPart(-4.0, 129.0, -4.0, 129.0, 31.0)]),
  heroHurtPose(34, 41, [hurtPart(-19.0, 31.0, -19.0, 31.0, 44.0), hurtPart(11.0, 103.0, 11.0, 103.0, 44.0), hurtPart(-16.0, 126.0, -16.0, 126.0, 34.0)]),
  heroHurtPose(42, 49, [hurtPart(-17.0, 34.0, -17.0, 34.0, 44.0), hurtPart(-1.0, 103.0, -1.0, 103.0, 44.0), hurtPart(-27.0, 122.0, -27.0, 122.0, 38.0)])
];
const down_special_air_hurt = [
  heroHurtPose(2, 9, [hurtPart(-18.0, 37.0, -18.0, 37.0, 44.0), hurtPart(-4.0, 102.0, -4.0, 102.0, 44.0), hurtPart(-32.0, 118.0, -32.0, 118.0, 42.0)]),
  heroHurtPose(10, 17, [hurtPart(-17.0, 30.0, -17.0, 30.0, 44.0), hurtPart(11.0, 104.0, 11.0, 104.0, 44.0), hurtPart(-10.0, 116.0, -10.0, 116.0, 44.0)]),
  heroHurtPose(18, 25, [hurtPart(-18.0, 30.0, -18.0, 30.0, 44.0), hurtPart(11.0, 104.0, 11.0, 104.0, 44.0), hurtPart(-5.0, 122.0, -5.0, 122.0, 38.0)]),
  heroHurtPose(26, 33, [hurtPart(-16.0, 32.0, -16.0, 32.0, 44.0), hurtPart(13.0, 104.0, 13.0, 104.0, 44.0), hurtPart(-13.0, 122.0, -13.0, 122.0, 38.0)]),
  heroHurtPose(34, 41, [hurtPart(-13.0, 33.0, -13.0, 33.0, 44.0), hurtPart(4.0, 103.0, 4.0, 103.0, 44.0), hurtPart(-23.0, 123.0, -23.0, 123.0, 37.0)]),
  heroHurtPose(42, 47, [hurtPart(-21.0, 33.0, -21.0, 33.0, 44.0), hurtPart(-5.0, 102.0, -5.0, 102.0, 44.0), hurtPart(-28.0, 123.0, -28.0, 123.0, 37.0)])
];
const impale = (air: boolean, ex: boolean): AuthoredSpecial => ({
  endFrame: 48, hurt: air ? neutral_special_air_hurt : neutral_special_ground_hurt, landingLag: air ? 24 : undefined,
  projectiles: [{ model: "Abilities\\Spells\\Undead\\Impale\\ImpaleMissTarget.mdl",
    spawnFrame: 18, offsetX: 40.0, offsetZ: 32.0, velocityX: 10.0, velocityZ: 0.0,
    life: 36, radius: ex ? 28.0 : 18.0, effect: anubarakHit(ex ? 16.103879928588867 : 11.148839950561523, 80, ex ? 82.73651885986328 : 68.3475570678711, 40.0), reflectable: true, limit: 1,
  }],
  ...(ex ? {} : { ex: impale(air, true) }),
});
const burrow = (ex: boolean): AuthoredSpecial => ({
  endFrame: 64, groundOnly: true, facesStick: true,
  motion: [{ ...frames(10, ex ? 29 : 25), velocityX: ex ? 13.0 : 10.0, velocityZ: 0.0, stopsAtShield: true }],
  hurt: [heroHurtPose(10, ex ? 29 : 25, [hurtPart(-20.0, 2.0, 20.0, 8.0, 14.0)])],
  regions: [heroRegion(ex ? 30 : 26, ex ? 33 : 29, { x1: -28.0, z1: 20.0, x2: 44.0, z2: 110.0, radius: ex ? 32.0 : 24.0 }, anubarakHit(ex ? 19.820161819458008 : 14.865119934082031, 80, 82.73651885986328, 38.0))],
  ...(ex ? {} : { ex: burrow(true) }),
});
const eruption = (ex: boolean): AuthoredSpecial => ({
  endFrame: 46, oncePerAirtime: true, helpless: true, aimFrames: CHARGED_AIM_FRAMES,
  motion: chargedAngleMotion(ex ? 640.0 : 400.0, 28),
  regions: [heroRegion(9, 16, { x1: 0.0, z1: 70.0, x2: 0.0, z2: 150.0, radius: ex ? 31.0 : 21.0 }, anubarakHit(ex ? 14.865119934082031 : 9.910080909729004, 80, 76.44135284423828, 28.0))],
  ...(ex ? {} : { ex: eruption(true) }),
});
const beetleShot = (ex: boolean) => ({ model: "Units\\Undead\\Scarab\\Scarab.mdl", spawnFrame: 0, offsetX: 24.0, offsetZ: 32.0,
      velocityX: 7.0, velocityZ: 0.0, life: 55, radius: 16.0, effect: anubarakHit(ex ? 8.671319961547852 : 6.19379997253418, 35, 58.45515060424805, 20.0), reflectable: true, limit: 4 });
const aerialBeetles = (ex: boolean): AuthoredSpecial => ({
  endFrame: 46, hurt: down_special_air_hurt, landingLag: 24,
  projectiles: [{ ...beetleShot(ex), spawnFrame: 22, offsetZ: 0.0, velocityX: 0.0, velocityZ: -7.0 }],
  ...(ex ? {} : { ex: aerialBeetles(true) }),
});
const beetles = (ex: boolean): AuthoredSpecial => ({
  endFrame: 46, hurt: down_special_ground_hurt, groundOnly: true,
  placement: { frame: 22, offsetX: 55.0, radius: 24.0, height: 35.0, durability: ex ? 36.0 : 24.0, life: 180,
    fireAges: ex ? [1, 37, 73, 109] : [1, 49, 97],
    shot: beetleShot(ex),
  },
  ...(ex ? {} : { ex: beetles(true) }),
});
export const ANUBARAK_SPECIALS: FighterSpecials = {
  neutral: { name: "Impale", description: "Drive a line of spines along the floor. Jump the line or block the stamp.", ground: impale(false, false), air: impale(true, false) },
  side: { name: "Burrow Hunt", description: "Scuttle beneath the floor and erupt. Follow the mound and punish the emergence.", ground: burrow(false) },
  up: { name: "Crypt Eruption", description: "Choose a direction and launch the crown, then fall helpless.", ground: eruption(false) },
  down: { name: "Carrion Beetle", description: "Plant a fragile nest that sends beetles along the ground. Press again to recall it.", ground: beetles(false), air: aerialBeetles(false), recall: { endFrame: 24, recall: true, ex: { endFrame: 24, recall: true, intangible: { first: 1, last: 4 } } } },
};
