import { f32 } from "wisp/src/sim/f32";
import { HeroStatusGroup, HeroStatusKind, HitElement } from "../../sim/codes";
import { HERO_REFERENCE_HEIGHT, heroRegion } from "../../sim/heroMoves";
import type { AppliedStatus } from "../../sim/appliedStatus";
import { frames, type AuthoredSpecial, type FighterSpecials, type SpecialMotion, type SpecialProjectile } from "../../sim/specials/schema";
import { archimondeCastBody, capsule, hit } from "./moves";

const h = (multiple: number): number => f32(HERO_REFERENCE_HEIGHT * f32(multiple));
const AIR_LANDING_LAG = 22;

const mark = (model: string, spawnFrame: number, life: number, offsetX: number): SpecialProjectile => ({
  model, spawnFrame, offsetX, offsetZ: 0.0, velocityX: 0.0, velocityZ: 0.0, life, radius: 1.0, activeFrom: life + 1,
  effect: hit(0.0, "LINK", 90), reflectable: false, limit: 4,
});

export const FINGER_STRIKE_FRAME = 32;
const FINGER_LINE: SpecialProjectile = { ...mark("Abilities\\Spells\\Human\\ManaFlare\\ManaFlareTarget.mdx", 1, FINGER_STRIKE_FRAME + 6, 0.0), atFoe: true };
const FINGER_COLUMN: SpecialProjectile = { ...mark("Abilities\\Spells\\Other\\Monsoon\\MonsoonBoltTarget.mdx", FINGER_STRIKE_FRAME, 12, 0.0), atMark: FINGER_LINE };
const fingerOfDeath = (air: boolean): AuthoredSpecial => ({
  endFrame: 58, landingLag: air ? AIR_LANDING_LAG : undefined,
  hurt: archimondeCastBody(4, 40, 90.0, 230.0),
  projectiles: [FINGER_LINE, FINGER_COLUMN],
  regionOrigin: FINGER_LINE,
  regions: [heroRegion(FINGER_STRIKE_FRAME, FINGER_STRIKE_FRAME + 5, capsule(0.0, -160.0, 0.0, 460.0, 22.0),
    { ...hit(16.0, "KILL", 70, 1.0, HitElement.dark), growth: 102.0 })],
});

const PILLAR_HIT = hit(9.0, "POKE", 80, 1.0, HitElement.fire);
const PILLARS = [{ frame: 24, x: 170.0 }, { frame: 36, x: 310.0 }] as const;
const LAST_PILLAR = 36;
const PILLAR_WARNING = 14;
const rainOfFire = (air: boolean): AuthoredSpecial => {
  return {
    endFrame: LAST_PILLAR + 22, landingLag: air ? AIR_LANDING_LAG : undefined,
    hurt: archimondeCastBody(4, LAST_PILLAR + 4, 70.0, 220.0),
    projectiles: PILLARS.map(({ frame, x }) => ({ ...mark("Abilities\\Spells\\Demon\\RainOfFire\\RainOfFireTarget.mdx", frame - PILLAR_WARNING, PILLAR_WARNING + 16, x), dropsToFloor: true })),
    regions: PILLARS.map(({ frame, x }) => heroRegion(frame, frame + 3, capsule(x, -400.0, x, 900.0, 44.0), PILLAR_HIT)),
    rehits: PILLARS.slice(1).map(({ frame }) => frame),
  };
};

const ASCENT_RISE = h(f32(1.8));
const ascentMotion = (rise: number): readonly SpecialMotion[] => [
  { ...frames(1, 9), velocityX: 0.0, velocityZ: 0.0 },
  { ...frames(10, 24), velocityX: 0.0, velocityZ: f32(rise / 15), driftSpeed: 2.0 },
  { ...frames(25, 30), velocityX: 0.0, velocityZ: 0.0, driftSpeed: 2.0 },
];
const felAscent = (rise: number): AuthoredSpecial => ({
  endFrame: 30, oncePerAirtime: true, helpless: true, landingLag: 28, facesStick: true,
  projectiles: [mark("Abilities\\Spells\\Other\\Doom\\DoomDeath.mdx", 8, 16, 0.0)],
  regions: [heroRegion(10, 20, capsule(0.0, -50.0, 0.0, 60.0, 40.0), hit(7.0, "LAUNCH", 80, 1.0, HitElement.fire))],
  motion: ascentMotion(rise),
});

export const BASH_STUN: AppliedStatus = { kind: HeroStatusKind.stun, frames: 30, group: HeroStatusGroup.sleep, immunityFrames: 240, groundedOnly: true };
const BASH_HELD = { ...hit(12.0, "LINK", 80, 1.0, HitElement.normal), growth: 0.0, base: 0.0, launchX: 0.0, launchZ: 0.0, setKnockback: 0.0 };
const bash = (reach: number): AuthoredSpecial => ({
  endFrame: 46, groundOnly: false,
  hurt: archimondeCastBody(10, 30, 90.0, 20.0),
  projectiles: [{ ...mark("Abilities\\Spells\\Human\\Thunderclap\\ThunderClapCaster.mdx", 16, 14, 60.0), dropsToFloor: true }],
  regions: [heroRegion(16, 18, capsule(f32(30.0 - reach), 18.0, f32(reach - 30.0), 18.0, 30.0), hit(12.0, "LAUNCH", 45, 1.0, HitElement.normal), BASH_HELD)],
  strikeStatus: BASH_STUN,
});
const BASH_AIR: AuthoredSpecial = {
  endFrame: 46, landingLag: AIR_LANDING_LAG,
  hurt: archimondeCastBody(10, 30, 70.0, 10.0),
  regions: [heroRegion(16, 19, capsule(40.0, 70.0, 55.0, -20.0, 26.0), hit(12.0, "SPIKE", 270, 1.0, HitElement.normal), hit(12.0, "LAUNCH", 60, 1.0, HitElement.normal))],
};

export const ARCHIMONDE_SPECIALS: FighterSpecials = {
  neutral: { name: "Finger of Death", description: "A violet line marks the foe where they stand; a moment later lightning strikes it. Step off the line, or punish his long cast up close.",
    ground: fingerOfDeath(false), air: fingerOfDeath(true) },
  side: { name: "Rain of Fire", description: "Two fire pillars fall ahead, near then far, as tall as the sky. Wait them out or rush in under his cast.",
    ground: rainOfFire(false), air: rainOfFire(true) },
  up: { name: "Fel Ascent", description: "He rises a short way on a column of fel fire that burns anyone below, then falls helpless. Guard the ledge against him.",
    ground: felAscent(ASCENT_RISE) },
  down: { name: "Bash", description: "A hammer-fist into the ground holds a grounded foe close by in place; in the air it drives them down. Shield it or jump it.",
    ground: bash(90.0), air: BASH_AIR },
};
