import { withExKit } from "../exSpecialAuthoring";
import { f32 } from "wisp/src/sim/f32";
import { HitElement } from "../codes";
import { CHILL } from "../chill";
import { HERO_REFERENCE_HEIGHT, heroRegion } from "../heroMoves";
import { type AuthoredSpecial, type FighterSpecials, FollowUpInput, frames } from "../specials/schema";
import { chenCapsule, chenHit } from "./chenMoves";

const fire = chenHit(9.370200157165527, 70.0, 25.73409652709961, f32(0.906308), f32(0.422618), HitElement.fire);
const breath = (air: boolean): AuthoredSpecial => ({
  endFrame: 48, landingLag: air ? 20 : undefined,
  regions: [
    heroRegion(18, 28, chenCapsule(36.0, 62.0, 76.0, 62.0, 27.0), fire),
    heroRegion(18, 28, chenCapsule(76.0, 62.0, 136.0, 62.0, 40.0), fire),
    heroRegion(18, 28, chenCapsule(136.0, 62.0, 196.0, 62.0, 55.0), fire),
    heroRegion(18, 28, chenCapsule(196.0, 62.0, 256.0, 62.0, 70.0), fire),
  ],
});
const haze = (air: boolean): AuthoredSpecial => ({
  endFrame: 38, landingLag: air ? 20 : undefined,
  projectiles: [{ spawnFrame: 14, offsetX: 40.0, offsetZ: 60.0, velocityX: 8.0, velocityZ: 0.5, gravity: f32(0.08),
    life: 38, radius: 22.0, effect: chenHit(2.8110599517822266, 35.0, 17.156063079833984, f32(0.819152), f32(0.573576)), reflectable: true, limit: 1,
    model: "Abilities\\Spells\\Other\\StrongDrink\\BrewmasterMissile.mdx",
    status: CHILL,
  }],
});
const stormRise = (height: number, drift: number): AuthoredSpecial => ({
  endFrame: 40, oncePerAirtime: true, helpless: true, facesStick: true,
  motion: [{ ...frames(1, 7), velocityX: 0.0, velocityZ: 0.0 }, { ...frames(8, 29), velocityX: 0.0, velocityZ: f32(f32(HERO_REFERENCE_HEIGHT * height) / 22.0), driftSpeed: f32(f32(HERO_REFERENCE_HEIGHT * drift) / 22.0) }],
  regions: [heroRegion(8, 22, chenCapsule(0.0, 42.0, 0.0, 106.0, 42.0), chenHit(7.49616003036499, 80.0, 27.878604888916016, f32(0.34202), f32(0.939693)))],
});
const FIRE_PALM: AuthoredSpecial = { name: "Fire Palm", endFrame: 32, landingLag: 20,
  regions: [heroRegion(8, 11, chenCapsule(24.0, 58.0, 94.0, 60.0, 22.0), chenHit(10.307220458984375, 90.0, 25.73409652709961, f32(0.819152), f32(0.573576), HitElement.fire))] };
const STORM_STEP: AuthoredSpecial = { name: "Storm Step", endFrame: 28, landingLag: 20, facesStick: true,
  motion: [{ ...frames(5, 12), velocityX: 10.0, velocityZ: 0.0, stopsAtShield: true }],
  regions: [heroRegion(5, 12, chenCapsule(20.0, 48.0, 60.0, 56.0, 18.0), chenHit(6.559140205383301, 75.0, 23.589588165283203, f32(0.642788), f32(0.766044)))] };
const earth = (air: boolean): AuthoredSpecial => ({
  name: "Earth Stance", endFrame: 33, landingLag: air ? 20 : undefined,
  armor: { ...frames(5, 16), maxDamage: 9.0 },
  followUps: [
    { window: frames(10, 22), input: FollowUpInput.attack, special: FIRE_PALM },
    { window: frames(10, 22), input: FollowUpInput.special, facesStick: true, special: STORM_STEP },
  ],
});
export const CHEN_SPECIALS: FighterSpecials = {
  neutral: withExKit({ name: "Breath of Fire", description: "Breathe a long, fanning cone of flame; jump above its widening tip.", ground: breath(false), air: breath(true) }, { reach: 1.25 }),
  side: withExKit({ name: "Drunken Haze", description: "Lob a flask that briefly slows an enemy's movement.", ground: haze(false), air: haze(true) }, { reach: 1.25 }),
  up: withExKit({ name: "Storm Rise", description: "Rise with a spinning staff, steer toward safety, then fall helplessly.", ground: stormRise(f32(3.0), 1.0) }, { travel: 1.25 }),
  down: withExKit({ name: "Threefold Stance", description: "Brace as Earth; press Attack for Fire Palm or Special for Storm Step.", ground: earth(false), air: earth(true) }, { armorDamage: 1.25, damage: 1.25 }),
};
