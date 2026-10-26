import { HeroStatusGroup, HeroStatusKind } from "../codes";
import { heroRegion, type StrikeCapsule } from "../heroMoves";
import { withExKit } from "../exSpecialAuthoring";
import { frames, type AuthoredSpecial, type FighterSpecials, type SpecialProjectile } from "../specials/schema";
import type { AppliedStatus } from "../heroStatus";
import { kaelCastBody, kaelHit } from "./kaelthasMoves";

const AIR_LANDING_LAG = 20;
const FIREBALL_LANDING_LAG = 10;

export const FIREBALL_LIMIT = 2;
export const FIREBALL: SpecialProjectile = {
  model: "Abilities\\Weapons\\PhoenixMissile\\Phoenix_Missile.mdx",
  spawnFrame: 9, offsetX: 40.0, offsetZ: 55.0, velocityX: 18.0, velocityZ: 0.0,
  life: 50, radius: 14.0, effect: kaelHit(3.0, 0, 8.0, 8.0),
  reflectable: true, limit: FIREBALL_LIMIT,
};
const fireball = (landingLag: number | undefined): AuthoredSpecial => ({
  endFrame: 26, landingLag, hurt: kaelCastBody(6, 18, 44.0, 58.0), projectiles: [FIREBALL],
});

const DRAIN_BEAM: StrikeCapsule = { x1: 30.0, z1: 60.0, x2: 120.0, z2: 60.0, radius: 18.0 };
const drainMana = (landingLag: number | undefined): AuthoredSpecial => ({
  endFrame: 38, landingLag, hurt: kaelCastBody(6, 20, 46.0, 60.0),
  commandGrab: { ...frames(10, 13), strike: DRAIN_BEAM, holdFrames: 18, effect: { ...kaelHit(4.338719844818115, 40, 38.02436065673828, 40.0), manaSteal: 30 }, recovery: 16 },
});

export const BANISH_FRAMES = 60;
export const BANISH: AppliedStatus = { kind: HeroStatusKind.banish, frames: BANISH_FRAMES, group: HeroStatusGroup.silence, immunityFrames: 240 };
const CURSE: StrikeCapsule = { x1: 25.0, z1: 62.0, x2: 110.0, z2: 62.0, radius: 20.0 };
const banish = (landingLag: number | undefined): AuthoredSpecial => ({
  endFrame: 36, landingLag, hurt: kaelCastBody(8, 22, 46.0, 62.0),
  regions: [heroRegion(12, 14, CURSE, kaelHit(3.254040002822876, 35, 0.0, 30.0))], strikeStatus: BANISH,
});

export const PHOENIX_CHARGE_FRAMES = 42;
export const PHOENIX_AIM_FRAMES = 14;
export const PHOENIX_FLIGHT_FRAMES = 30;
export const PHOENIX_SPEED = 16.0;
const SWIRL: StrikeCapsule = { x1: -20.0, z1: 55.0, x2: 20.0, z2: 55.0, radius: 42.0 };
const BIRD: StrikeCapsule = { x1: -24.0, z1: 55.0, x2: 24.0, z2: 55.0, radius: 32.0 };
const swirl = kaelHit(2.1693599224090576, 80, 0.0, 30.0);
const phoenix = (speed: number): AuthoredSpecial => ({
  endFrame: 84, aimFrames: PHOENIX_AIM_FRAMES, rehits: [25, 31, 37, PHOENIX_CHARGE_FRAMES], oncePerAirtime: true, helpless: true, landingLag: 18,
  motion: [
    { ...frames(1, 15), velocityX: 0.0, velocityZ: 0.0 },
    { ...frames(16, PHOENIX_CHARGE_FRAMES), velocityX: 0.0, velocityZ: -0.5 },
    { ...frames(PHOENIX_CHARGE_FRAMES + 1, PHOENIX_CHARGE_FRAMES + PHOENIX_FLIGHT_FRAMES), velocityX: 0.0, velocityZ: speed, aimedSpeed: speed, liftSpeed: 1.5 },
  ],
  regions: [
    heroRegion(20, 21, SWIRL, swirl), heroRegion(26, 27, SWIRL, swirl), heroRegion(32, 33, SWIRL, swirl), heroRegion(38, 39, SWIRL, swirl),
    heroRegion(43, 52, BIRD, kaelHit(11.0, 55, 76.04872131347656, 40.0)), heroRegion(53, 72, BIRD, kaelHit(6.508080005645752, 70, 57.03654098510742, 30.0)),
  ],
});

export const KAELTHAS_SPECIALS: FighterSpecials = {
  neutral: withExKit({ name: "Fireball", description: "A fast, weak fire missile straight ahead, two on screen at most. Shield, jump or reflect it.",
    ground: fireball(undefined), air: fireball(FIREBALL_LANDING_LAG) }, { damage: 1.25 }),
  side: withExKit({ name: "Drain Mana", description: "A short tether that grabs through shields and drinks the victim's meter. Jump or dodge it.",
    ground: drainMana(undefined), air: drainMana(AIR_LANDING_LAG) }, { damage: 1.25 }),
  up: withExKit({ name: "Phoenix", description: "Charge in swirling flame, then fly as a phoenix the way you aim; up or down bends the flight. Helpless after.",
    ground: phoenix(PHOENIX_SPEED) }, { travel: 1.25 }),
  down: withExKit({ name: "Banish", description: "A close curse: the victim turns ethereal, untouchable by attacks and grabs but unable to attack, grab or shield, and takes more damage from every spell.",
    ground: banish(undefined), air: banish(18) }, { reach: 1.25 }),
};
