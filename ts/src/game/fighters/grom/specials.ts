import { heroRegion } from "../../sim/heroMoves";
import { frames, type AuthoredSpecial, type FighterSpecials } from "../../sim/specials/schema";
import { gromHit } from "./moves";
import { hurtPart, hurtPose } from "../../sim/hurtboxes";
const cry: AuthoredSpecial = { endFrame: 34, hurt: [hurtPose(1, 12, [hurtPart(3.0, 27.0, -37.0, 171.0, 26.0)]), hurtPose(13, 33, [hurtPart(5.0, 27.0, -15.0, 173.0, 18.0)])], regions: [heroRegion(12, 15, { x1: -44.0, z1: 48.0, x2: 44.0, z2: 48.0, radius: 38.0 }, gromHit(5.068727970123291, 80, 72.46424102783203, 37.79999923706055))] };
const rush = (air: boolean): AuthoredSpecial => ({
  endFrame: 40, oncePerAirtime: air ? true : undefined, helpless: air ? true : undefined,
  motion: [{ ...frames(8, 20), velocityX: 13.0, velocityZ: 0.0, stopsAtShield: true }, { ...frames(21, 21), velocityX: 0.0, velocityZ: 0.0 }],
  regions: [heroRegion(10, 17, { x1: 24.0, z1: 60.0, x2: 104.0, z2: 48.0, radius: 14.0 }, gromHit(8.689248085021973, 40, 100.33509826660156, 23.399999618530273))],
});
const leap: AuthoredSpecial = {
  endFrame: 36, oncePerAirtime: true, helpless: true, facesStick: true,
  hurt: [hurtPose(1, 35, [hurtPart(-8.0, 0.0, -41.0, 119.0, 40.0)])],
  motion: [{ ...frames(1, 6), velocityX: 0.0, velocityZ: 0.0 }, { ...frames(7, 22), velocityX: 0.0, velocityZ: 24.0, driftSpeed: 13.0 }, { ...frames(23, 23), velocityX: 0.0, velocityZ: 0.0 }],
  regions: [heroRegion(7, 14, { x1: 12.0, z1: 54.0, x2: 12.0, z2: 146.0, radius: 16.0 }, gromHit(6.516936302185059, 80, 94.76093292236328, 27.0))],
};
const bane: AuthoredSpecial = { endFrame: 50, regions: [heroRegion(20, 23, { x1: 24.0, z1: 94.0, x2: 124.0, z2: 20.0, radius: 16.0 }, gromHit(15.930286407470703, 35, 131.55047607421875, 27.0))] };
export const GROM_SPECIALS: FighterSpecials = {
  neutral: { name: "Warsong Cry", description: "Roar in their face and launch them upward. Rush after them.", ground: cry, air: { ...cry, landingLag: 20, hurt: [hurtPose(1, 12, [hurtPart(8.0, 8.0, -7.0, 141.0, 52.0), hurtPart(-32.0, 90.0, -28.0, 117.0, 29.0)]), hurtPose(13, 33, [hurtPart(8.0, 8.0, 4.0, 148.0, 44.0), hurtPart(-16.0, 90.0, -12.0, 109.0, 21.0)])] } },
  side: { name: "Gorehowl Rush", description: "Charge axe-first. A shield stops the rush; a miss leaves you open.", ground: rush(false), air: rush(true) },
  up: { name: "Blood Leap", description: "Haul Gorehowl upward as you leap, then fall helpless.", ground: leap },
  down: { name: "Mannoroth's Bane", description: "Commit to a furious two-handed execution chop.", ground: bane, air: { ...bane, landingLag: 24 } },
};
