import { f32 } from "wisp/src/sim/f32";
import { HeroStatusGroup, HeroStatusKind } from "../../sim/codes";
import { heroRegion, type StrikeCapsule } from "../../sim/heroMoves";
import { withExKit } from "../../sim/exSpecialAuthoring";
import { frames, type AuthoredSpecial, type FighterSpecials, type SpecialProjectile, type SpecialSteeredShot } from "../../sim/specials/schema";
import type { AppliedStatus } from "../../sim/heroStatus";
import { kaelCastBody, kaelHit } from "./moves";

const AIR_LANDING_LAG = 20;

export const PYROBLAST_STARTUP_FRAMES = 18;
export const PYROBLAST_STEER_FRAMES = 60;
export const PYROBLAST_COAST_FRAMES = 14;
export const PYROBLAST_MISS_RECOVERY = 40;
export const PYROBLAST_HIT_RECOVERY = 18;
export const PYROBLAST_SPEED = 7.5;
export const PYROBLAST: SpecialProjectile = {
  model: "Abilities\\Weapons\\RedDragonBreath\\RedDragonMissile.mdx",
  spawnFrame: PYROBLAST_STARTUP_FRAMES, offsetX: 52.0, offsetZ: 60.0, velocityX: PYROBLAST_SPEED, velocityZ: 0.0,
  life: PYROBLAST_STEER_FRAMES + PYROBLAST_COAST_FRAMES, radius: 22.0, effect: { ...kaelHit(17.0, 40, 80.0, 25.0), strong: true },
  reflectable: true, limit: 1, steered: true,
};
export const PYROBLAST_STEER: SpecialSteeredShot = {
  frame: PYROBLAST_STARTUP_FRAMES, turnCos: 0.9945219159126282, turnSin: 0.10452846437692642,
  coast: PYROBLAST_COAST_FRAMES, fallSpeed: 1.5, hitRecovery: PYROBLAST_HIT_RECOVERY,
};
const pyroblast: AuthoredSpecial = {
  endFrame: PYROBLAST_STARTUP_FRAMES + PYROBLAST_MISS_RECOVERY, hurt: kaelCastBody(6, PYROBLAST_STARTUP_FRAMES + 8, 44.0, 64.0),
  projectiles: [PYROBLAST], steersShot: PYROBLAST_STEER,
};

// FlameStrike1.mdx draws its column only in birth, fading in by 1.05 s and out by 5.1 s; the pillar plays that stretch across its burst and burn frames.
export const FLAME_STRIKE_BURST_FRAMES = 6;
export const FLAME_STRIKE_BURN_FRAMES = 30;
export const FLAME_STRIKE_COLUMN_SECONDS = { from: f32(1.05), to: f32(5.1) } as const;
export const FLAME_STRIKE_COLUMN_RATE = (FLAME_STRIKE_COLUMN_SECONDS.to - FLAME_STRIKE_COLUMN_SECONDS.from) / ((FLAME_STRIKE_BURST_FRAMES + FLAME_STRIKE_BURN_FRAMES) / 60);
const FLAME_STRIKE_BURN_SEEK = FLAME_STRIKE_COLUMN_SECONDS.from + FLAME_STRIKE_COLUMN_RATE * FLAME_STRIKE_BURST_FRAMES / 60;
export const FLAME_STRIKE_BURN: SpecialProjectile = {
  model: "Abilities\\Spells\\Human\\FlameStrike\\FlameStrike1.mdx", modelRadius: 155.0, modelOffsetZ: -50.0,
  modelAnimation: { sequence: "birth", warningSeconds: FLAME_STRIKE_BURN_SEEK, activeSeconds: FLAME_STRIKE_BURN_SEEK, rate: FLAME_STRIKE_COLUMN_RATE },
  spawnFrame: 0, offsetX: 0.0, offsetZ: 0.0, velocityX: 0.0, velocityZ: 0.0,
  life: FLAME_STRIKE_BURN_FRAMES, radius: 45.0, effect: kaelHit(2.0, 80, 0.0, 0.0), burn: { every: 8 }, reflectable: false, limit: 1,
};
export const FLAME_STRIKE_BURST: SpecialProjectile = {
  model: "Abilities\\Spells\\Human\\FlameStrike\\FlameStrike1.mdx", modelRadius: 155.0, modelOffsetZ: -50.0,
  modelAnimation: { sequence: "birth", warningSeconds: FLAME_STRIKE_COLUMN_SECONDS.from, activeSeconds: FLAME_STRIKE_COLUMN_SECONDS.from, rate: FLAME_STRIKE_COLUMN_RATE },
  spawnFrame: 0, offsetX: 0.0, offsetZ: 50.0, velocityX: 0.0, velocityZ: 0.0,
  life: FLAME_STRIKE_BURST_FRAMES, radius: 45.0, effect: kaelHit(14.0, 80, 90.30785369873047, 30.0), expiresInto: FLAME_STRIKE_BURN, reflectable: false, limit: 1,
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
  neutral: withExKit({ name: "Pyroblast", description: "A slow, heavy fireball he steers with the stick while he stands rooted; special or shield lets it go. It hits hard and cracks shields, but a miss leaves him open. One at a time.",
    ground: pyroblast }, { reach: 1.25 }),
  side: withExKit({ name: "Flame Strike", description: "Hold to slide a rune outward, release to call a pillar of fire onto it; the pillar lingers and burns. Over open air it stands at Kael's height. One at a time.",
    ground: flameStrike(undefined), air: flameStrike(AIR_LANDING_LAG) }, { reach: 1.25 }),
  up: withExKit({ name: "Phoenix", description: "Rise as a phoenix and steer the flight while its flames burn down; then helpless. Struck in flight, he falls as an egg and hatches on landing.",
    ground: phoenix }, { travel: 1.25 }),
  down: withExKit({ name: "Banish", description: "A close curse: the victim turns ethereal, untouchable by attacks and grabs but unable to attack, grab or shield, and takes more damage from every spell.",
    ground: banish(undefined), air: banish(18) }, { reach: 1.25 }),
};
