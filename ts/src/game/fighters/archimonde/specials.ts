import { f32 } from "wisp/src/sim/f32";
import { HeroStatusGroup, HeroStatusKind, HitElement } from "../../sim/codes";
import { HERO_REFERENCE_HEIGHT, heroRegion } from "../../sim/heroMoves";
import type { AppliedStatus } from "../../sim/appliedStatus";
import { frames, type AuthoredSpecial, type FighterSpecials, type SpecialMotion, type SpecialProjectile } from "../../sim/specials/schema";
import { archimondeCastBody, capsule, hit } from "./moves";

const h = (multiple: number): number => f32(HERO_REFERENCE_HEIGHT * f32(multiple));
const AIR_LANDING_LAG = 22;
const FLAME_RING_MODEL = "Abilities\\Spells\\Human\\FlameStrike\\FlameStrikeTarget.mdx";

const mark = (model: string, spawnFrame: number, life: number, offsetX: number): SpecialProjectile => ({
  model, spawnFrame, offsetX, offsetZ: 0.0, velocityX: 0.0, velocityZ: 0.0, life, radius: 1.0, activeFrom: life + 1,
  effect: hit(0.0, "LINK", 90), reflectable: false, limit: 4,
});

export const FINGER_STRIKE_FRAME = 32;
const FINGER_RADIUS = 22.0;
const FINGER_FLOOR = -160.0;
const FINGER_CEILING = 460.0;
const MONSOON_ART_HEIGHT = 936.0;
const MONSOON_ART_BASE = 15.0;
const MONSOON_CUE_SCALE = f32(0.7);
const FINGER_LOCK_RADIUS = 110.0;
export const FINGER_COLUMN_WIDTH = 6.0;
const FINGER_ART_SCALE = f32((FINGER_CEILING - FINGER_FLOOR) / MONSOON_ART_HEIGHT);
const FINGER_COLUMN: SpecialProjectile = {
  ...mark("Abilities\\Spells\\Other\\Monsoon\\MonsoonBoltTarget.mdx", 0, 12, 0.0),
  radius: FINGER_RADIUS, modelRadius: f32(FINGER_RADIUS * MONSOON_CUE_SCALE / FINGER_ART_SCALE), modelOffsetZ: f32(FINGER_FLOOR - MONSOON_ART_BASE * FINGER_ART_SCALE),
};
const FINGER_LINE: SpecialProjectile = { ...mark("Abilities\\Spells\\Human\\ManaFlare\\ManaFlareTarget.mdx", 1, FINGER_STRIKE_FRAME + 6, 0.0), atFoe: true, radius: FINGER_RADIUS, modelRadius: f32(FINGER_RADIUS / 2.0) };
export const FINGER_LOCK: SpecialProjectile = {
  ...mark(FLAME_RING_MODEL, 1, FINGER_STRIKE_FRAME, 0.0),
  atFoe: true, radius: FINGER_LOCK_RADIUS, expiresInto: FINGER_COLUMN,
};
const fingerOfDeath = (air: boolean): AuthoredSpecial => ({
  endFrame: 58, landingLag: air ? AIR_LANDING_LAG : undefined,
  hurt: archimondeCastBody(4, 40, 90.0, 230.0),
  projectiles: [FINGER_LINE, FINGER_LOCK],
  regionOrigin: FINGER_LINE,
  regions: [heroRegion(FINGER_STRIKE_FRAME, FINGER_STRIKE_FRAME + 5, capsule(0.0, FINGER_FLOOR, 0.0, FINGER_CEILING, FINGER_RADIUS),
    { ...hit(16.0, "KILL", 70, 1.0, HitElement.dark), growth: 102.0 })],
});

const PILLAR_HIT = hit(9.0, "POKE", 80, 1.0, HitElement.fire);
const PILLARS = [{ frame: 24, x: 170.0 }, { frame: 36, x: 310.0 }] as const;
const LAST_PILLAR = 36;
const PILLAR_RADIUS = 44.0;
const PILLAR_FLOOR = -400.0;
const PILLAR_CEILING = 900.0;
const PILLAR_COLUMN_LIFE = 14;
const FLAME_ART_HEIGHT = 1105.0;
const FLAME_ART_BASE = 86.0;
const FLAME_ART_RADIUS = 190.0;
const PILLAR_ART_SCALE = f32(PILLAR_RADIUS / FLAME_ART_RADIUS);
export const PILLAR_COLUMN_STRETCH = f32(f32(PILLAR_CEILING - PILLAR_FLOOR) / f32(FLAME_ART_HEIGHT * PILLAR_ART_SCALE));
// FlameStrike.mdx draws its column only in birth, fading in by 1.05 s and out by 5.1 s; the pillar plays its widest stretch across its life, so the column is full on its first frame.
const FLAME_COLUMN_SECONDS = { from: f32(4.0), to: f32(5.1) } as const;
const pillarColumn = (): SpecialProjectile => ({
  ...mark("Abilities\\Spells\\Human\\FlameStrike\\FlameStrike.mdx", 0, PILLAR_COLUMN_LIFE, 0.0),
  radius: PILLAR_RADIUS, modelRadius: FLAME_ART_RADIUS, modelOffsetZ: f32(PILLAR_FLOOR + FLAME_ART_BASE * PILLAR_ART_SCALE * PILLAR_COLUMN_STRETCH),
  modelAnimation: { sequence: "birth", warningSeconds: FLAME_COLUMN_SECONDS.from, activeSeconds: FLAME_COLUMN_SECONDS.from,
    rate: f32((FLAME_COLUMN_SECONDS.to - FLAME_COLUMN_SECONDS.from) / (PILLAR_COLUMN_LIFE / 60)) },
});
const pillarWarning = (frame: number, x: number): SpecialProjectile => ({
  ...mark(FLAME_RING_MODEL, 1, frame, x), radius: PILLAR_RADIUS, dropsToFloor: true, expiresInto: { ...pillarColumn(), dropsToFloor: true },
});
const rainOfFire = (air: boolean): AuthoredSpecial => {
  return {
    endFrame: LAST_PILLAR + 22, landingLag: air ? AIR_LANDING_LAG : undefined,
    hurt: archimondeCastBody(4, LAST_PILLAR + 4, 70.0, 220.0),
    projectiles: PILLARS.map(({ frame, x }) => pillarWarning(frame, x)),
    regions: PILLARS.map(({ frame, x }) => heroRegion(frame, frame + 3, capsule(x, PILLAR_FLOOR, x, PILLAR_CEILING, PILLAR_RADIUS), PILLAR_HIT)),
    rehits: PILLARS.slice(1).map(({ frame }) => frame),
  };
};

const ASCENT_RISE = h(f32(2.6));
const ascentMotion = (rise: number): readonly SpecialMotion[] => [
  { ...frames(1, 9), velocityX: 0.0, velocityZ: 0.0 },
  { ...frames(10, 24), velocityX: 0.0, velocityZ: f32(rise / 15), driftSpeed: 6.0 },
  { ...frames(25, 30), velocityX: 0.0, velocityZ: 0.0, driftSpeed: 6.0 },
];
const felAscent = (rise: number): AuthoredSpecial => ({
  endFrame: 30, oncePerAirtime: true, helpless: true, landingLag: 28, facesStick: true,
  projectiles: [mark("Abilities\\Spells\\Other\\Doom\\DoomDeath.mdx", 8, 16, 0.0)],
  regions: [heroRegion(10, 20, capsule(0.0, -50.0, 0.0, 60.0, 40.0), hit(7.0, "LAUNCH", 80, 1.0, HitElement.fire))],
  motion: ascentMotion(rise),
});

export const BASH_STUN: AppliedStatus = { kind: HeroStatusKind.stun, frames: 30, group: HeroStatusGroup.sleep, immunityFrames: 240, groundedOnly: true };
const BASH_FIRST = 16;
const BASH_SECOND = 24;
const BASH_HIT_DAMAGE = 6.0;
const BASH_HELD = { ...hit(BASH_HIT_DAMAGE, "LINK", 80, 1.0, HitElement.normal), growth: 0.0, base: 0.0, launchX: 0.0, launchZ: 0.0, setKnockback: 0.0 };
const BASH_LAUNCH = hit(BASH_HIT_DAMAGE, "LAUNCH", 45, 1.0, HitElement.normal);
const bash = (reach: number): AuthoredSpecial => {
  const fist = capsule(f32(30.0 - reach), 18.0, f32(reach - 30.0), 18.0, 30.0);
  return {
    endFrame: 46, groundOnly: false,
    hurt: archimondeCastBody(10, 30, 90.0, 20.0),
    projectiles: [BASH_FIRST, BASH_SECOND].map((frame) => ({ ...mark("Abilities\\Spells\\Human\\Thunderclap\\ThunderClapCaster.mdx", frame, 14, 60.0), dropsToFloor: true })),
    regions: [heroRegion(BASH_FIRST, BASH_FIRST + 2, fist, BASH_LAUNCH, BASH_HELD), heroRegion(BASH_SECOND, BASH_SECOND + 2, fist, BASH_LAUNCH)],
    rehits: [BASH_SECOND],
    strikeStatus: BASH_STUN,
  };
};
const BASH_AIR_FIST = capsule(40.0, 70.0, 55.0, -20.0, 26.0);
const BASH_AIR: AuthoredSpecial = {
  endFrame: 46, landingLag: AIR_LANDING_LAG,
  hurt: archimondeCastBody(10, 30, 70.0, 10.0),
  regions: [
    heroRegion(BASH_FIRST, BASH_FIRST + 3, BASH_AIR_FIST, hit(BASH_HIT_DAMAGE, "SPIKE", 270, 1.0, HitElement.normal), hit(BASH_HIT_DAMAGE, "LAUNCH", 60, 1.0, HitElement.normal)),
    heroRegion(BASH_SECOND, BASH_SECOND + 3, BASH_AIR_FIST, hit(BASH_HIT_DAMAGE, "LAUNCH", 60, 1.0, HitElement.normal)),
  ],
  rehits: [BASH_SECOND],
};

export const ARCHIMONDE_SPECIALS: FighterSpecials = {
  neutral: { name: "Finger of Death", description: "A glowing ring locks onto the foe and burns hotter for half a second, then a lightning column as wide as the ring strikes it. Step off the ring, or punish his long cast up close.",
    ground: fingerOfDeath(false), air: fingerOfDeath(true) },
  side: { name: "Rain of Fire", description: "A burning ring marks where each of two fire pillars will land, near then far, and each pillar is as tall as the sky. Leave the rings, or rush in under his cast.",
    ground: rainOfFire(false), air: rainOfFire(true) },
  up: { name: "Fel Ascent", description: "He rises a short way on a column of fel fire that burns anyone below, then falls helpless. Guard the ledge against him.",
    ground: felAscent(ASCENT_RISE) },
  down: { name: "Bash", description: "Two hammer-fists into the ground: the first holds a grounded foe close by in place, the second launches them out of the hold; in the air the first drives them down. Shield it or jump it.",
    ground: bash(90.0), air: BASH_AIR },
};
