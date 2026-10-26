import { HeroStatusGroup, HeroStatusKind } from "../../sim/codes";
import { heroRegion, type StrikeCapsule } from "../../sim/heroMoves";
import { withExKit } from "../../sim/exSpecialAuthoring";
import { frames, type AuthoredSpecial, type FighterSpecials, type SpecialProjectile } from "../../sim/specials/schema";
import type { AppliedStatus } from "../../sim/heroStatus";
import { kaelCastBody, kaelHit } from "./moves";

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

// FlameStrike1.mdx draws its column only in birth, from about 1.0 s to 4.7 s; its stand is fully transparent.
const FLAME_STRIKE_PILLAR_SECONDS = 1.25;
const FLAME_STRIKE_BURN_SECONDS = 2.0;
export const FLAME_STRIKE_BURN: SpecialProjectile = {
  model: "Abilities\\Spells\\Human\\FlameStrike\\FlameStrike1.mdx", modelRadius: 155.0, modelOffsetZ: -50.0,
  modelAnimation: { sequence: "birth", warningSeconds: FLAME_STRIKE_BURN_SECONDS, activeSeconds: FLAME_STRIKE_BURN_SECONDS },
  spawnFrame: 0, offsetX: 0.0, offsetZ: 0.0, velocityX: 0.0, velocityZ: 0.0,
  life: 48, radius: 45.0, effect: kaelHit(2.0, 80, 0.0, 0.0), burn: { every: 8 }, reflectable: false, limit: 1,
};
export const FLAME_STRIKE_BURST: SpecialProjectile = {
  model: "Abilities\\Spells\\Human\\FlameStrike\\FlameStrike1.mdx", modelRadius: 155.0, modelOffsetZ: -50.0,
  modelAnimation: { sequence: "birth", warningSeconds: FLAME_STRIKE_PILLAR_SECONDS, activeSeconds: FLAME_STRIKE_PILLAR_SECONDS },
  spawnFrame: 0, offsetX: 0.0, offsetZ: 50.0, velocityX: 0.0, velocityZ: 0.0,
  life: 6, radius: 45.0, effect: kaelHit(14.0, 80, 90.30785369873047, 30.0), expiresInto: FLAME_STRIKE_BURN, reflectable: false, limit: 1,
};
export const FLAME_STRIKE_RUNE: SpecialProjectile = {
  model: "Abilities\\Spells\\Human\\FlameStrike\\FlameStrikeTarget.mdx",
  spawnFrame: 8, offsetX: 80.0, offsetZ: 0.0, velocityX: 0.0, velocityZ: 0.0, dropsToFloor: true,
  life: 34, activeFrom: 35, radius: 45.0, effect: kaelHit(0.0, 80), expiresInto: FLAME_STRIKE_BURST, reflectable: false, limit: 1, cancelOnInterrupt: true,
};
export const FLAME_STRIKE_AIM = { frame: FLAME_STRIKE_RUNE.spawnFrame, reach: 320.0, speed: 8.0 } as const;
const flameStrike = (landingLag: number | undefined): AuthoredSpecial => ({
  endFrame: 30, landingLag, hurt: kaelCastBody(4, 24, 40.0, 66.0), projectiles: [FLAME_STRIKE_RUNE], aim: FLAME_STRIKE_AIM, replacesLive: true,
});

export const BANISH_FRAMES = 60;
export const BANISH: AppliedStatus = { kind: HeroStatusKind.banish, frames: BANISH_FRAMES, group: HeroStatusGroup.silence, immunityFrames: 240 };
const CURSE: StrikeCapsule = { x1: 25.0, z1: 62.0, x2: 110.0, z2: 62.0, radius: 20.0 };
const banish = (landingLag: number | undefined): AuthoredSpecial => ({
  endFrame: 36, landingLag, hurt: kaelCastBody(8, 22, 46.0, 62.0),
  regions: [heroRegion(12, 14, CURSE, kaelHit(3.254040002822876, 35, 0.0, 30.0))], strikeStatus: BANISH,
});

export const PHOENIX_STARTUP_FRAMES = 12;
export const PHOENIX_BURN_FRAMES = 40;
export const PHOENIX_EGG_FALL_SPEED = 24.0;
export const PHOENIX_EGG_HATCH_FRAMES = 30;
const PHOENIX_TURN_COS = 0.9961947202682495;
const PHOENIX_TURN_SIN = 0.08715574443340302;
const PHOENIX_FLIGHT = frames(PHOENIX_STARTUP_FRAMES + 1, PHOENIX_STARTUP_FRAMES + PHOENIX_BURN_FRAMES);
const BIRD: StrikeCapsule = { x1: -24.0, z1: 55.0, x2: 24.0, z2: 55.0, radius: 32.0 };
const phoenix: AuthoredSpecial = {
  endFrame: PHOENIX_STARTUP_FRAMES + PHOENIX_BURN_FRAMES, aimFrames: PHOENIX_STARTUP_FRAMES, oncePerAirtime: true, helpless: true, landingLag: 18,
  motion: [
    { ...frames(1, PHOENIX_STARTUP_FRAMES), velocityX: 0.0, velocityZ: 0.0 },
    { ...PHOENIX_FLIGHT, velocityX: 0.0, velocityZ: 0.0,
      steer: { launchSpeed: 9.0, speed: 14.5, acceleration: 0.5, turnCos: PHOENIX_TURN_COS, turnSin: PHOENIX_TURN_SIN } },
  ],
  regions: [heroRegion(PHOENIX_FLIGHT.first, PHOENIX_FLIGHT.last, BIRD, kaelHit(4.0, 55, 30.0, 30.0))],
  egg: { window: PHOENIX_FLIGHT, fallSpeed: PHOENIX_EGG_FALL_SPEED, hatchFrames: PHOENIX_EGG_HATCH_FRAMES },
};

export const KAELTHAS_SPECIALS: FighterSpecials = {
  neutral: withExKit({ name: "Fireball", description: "A fast, weak fire missile straight ahead, two on screen at most. Shield, jump or reflect it.",
    ground: fireball(undefined), air: fireball(FIREBALL_LANDING_LAG) }, { damage: 1.25 }),
  side: withExKit({ name: "Flame Strike", description: "Hold to slide a rune outward, release to call a pillar of fire onto it; the pillar lingers and burns. Over open air it stands at Kael's height. One at a time.",
    ground: flameStrike(undefined), air: flameStrike(AIR_LANDING_LAG) }, { damage: 1.25 }),
  up: withExKit({ name: "Phoenix", description: "Rise as a phoenix and steer the flight while its flames burn down; then helpless. Struck in flight, he falls as an egg and hatches on landing.",
    ground: phoenix }, { travel: 1.25 }),
  down: withExKit({ name: "Banish", description: "A close curse: the victim turns ethereal, untouchable by attacks and grabs but unable to attack, grab or shield, and takes more damage from every spell.",
    ground: banish(undefined), air: banish(18) }, { reach: 1.25 }),
};
