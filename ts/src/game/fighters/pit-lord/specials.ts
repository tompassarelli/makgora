


import { f32 } from "wisp/src/sim/f32";
import { HeroStatusGroup, HeroStatusKind, HitElement } from "../../sim/codes";
import { HERO_REFERENCE_HEIGHT, heroRegion } from "../../sim/heroMoves";
import { type AuthoredSpecial, type FighterSpecials, type SpecialMotion, type SpecialProjectile, frames } from "../../sim/specials/schema";
import { hurtPart, hurtPose } from "../../sim/hurtboxes";
import { capsule, hit } from "./moves";

const H = HERO_REFERENCE_HEIGHT;
const h = (multiple: number): number => f32(H * f32(multiple));
const perFrame = (distance: number, first: number, last: number): number => f32(distance / (last - first + 1));


const AIR_SPECIAL_LANDING_LAG = 24;
const HOWL_HURT = [
    hurtPose(1, 39, [hurtPart(-30.0, 26.0, 16.0, 103.0, 56.0)]),
];
const HOWL_AIR_HURT = [
    hurtPose(1, 39, [hurtPart(-30.0, 26.0, 16.0, 103.0, 56.0)]),
];
const CHARGE_HURT = [
    hurtPose(1, 63, [hurtPart(-37.0, 34.0, 40.0, 87.0, 56.0)]),
];
const CHARGE_AIR_HURT = [
    hurtPose(1, 63, [hurtPart(-37.0, 34.0, 40.0, 87.0, 56.0)]),
];
const LEAP_HURT = [
    hurtPose(1, 31, [hurtPart(-22.0, 47.0, 6.0, 113.0, 75.0)]),
];
export const RAIN_CHANNEL = { first: 16, last: 33, rewinds: 3 } as const;
export const RAIN_END = 55;
const RAIN_HURT = [
    hurtPose(1, RAIN_END, [hurtPart(-30.0, 27.0, 16.0, 103.0, 56.0)]),
];

const drawnOnly = (model: string, spawnFrame: number, life: number, offsetX: number, offsetZ: number, modelRadius: number): SpecialProjectile => ({
  model, spawnFrame, life, offsetX, offsetZ, velocityX: 0.0, velocityZ: 0.0, radius: 1.0, modelRadius, activeFrom: life + 1,
  effect: hit(0.0, "LINK", 90), reflectable: false, limit: 4,
});

const METEOR_FALL = 12;
const METEOR_DRIFT = h(f32(0.1));
const METEOR_SINK = h(f32(0.18));
const METEOR_CLEARANCE = h(f32(0.2));
export const METEOR_HIT = hit(f32(2.0), "LINK", 80, 1.0, HitElement.fire);
const IMPACT = drawnOnly("Abilities\\Spells\\Other\\Incinerate\\FireLordDeathExplode.mdx", 0, 12, 0.0, 0.0, f32(1.6));
export const RAIN_LANDINGS = [f32(1.7), f32(2.6), f32(2.15)] as const;
const meteor = (wave: number, landing: number): SpecialProjectile => ({
  spawnFrame: RAIN_CHANNEL.first + wave, offsetX: f32(h(landing) - f32(METEOR_DRIFT * METEOR_FALL)), offsetZ: f32(METEOR_CLEARANCE + f32(METEOR_SINK * METEOR_FALL)),
  velocityX: METEOR_DRIFT, velocityZ: -METEOR_SINK, life: METEOR_FALL, activeFrom: METEOR_FALL - 4, radius: h(f32(0.3)), modelRadius: h(f32(0.1)),
  effect: METEOR_HIT, reflectable: false, limit: 1, dropsToFloor: true, cancelOnInterrupt: true, expiresInto: IMPACT,
  model: "Abilities\\Weapons\\FireBallMissile\\FireBallMissile.mdx",
});
const SCORCH = "Doodads\\Cinematic\\TownBurningFireEmitter\\TownBurningFireEmitter.mdx";
const scorch = (spawnFrame: number, life: number): SpecialProjectile[] =>
  [f32(1.85), f32(2.45)].map(at => ({ ...drawnOnly(SCORCH, spawnFrame, life, h(at), 0.0, f32(2.2)), dropsToFloor: true, cancelOnInterrupt: true }));
const CHANNEL_GLOW: SpecialProjectile = {
  ...drawnOnly("Abilities\\Spells\\Other\\ImmolationRed\\ImmolationRedDamage.mdx", RAIN_CHANNEL.first, RAIN_CHANNEL.last - RAIN_CHANNEL.first + 2, h(f32(0.35)), h(f32(0.9)), f32(1.4)),
  cancelOnInterrupt: true,
};

const RAIN_OF_FIRE = [
  ...scorch(6, 36), ...scorch(RAIN_CHANNEL.first + 10, 26), CHANNEL_GLOW,
  ...RAIN_LANDINGS.map((landing, index) => meteor(3 * index, landing)),
];
const rain = (air: boolean): AuthoredSpecial => ({
  endFrame: RAIN_END, projectiles: RAIN_OF_FIRE, hurt: RAIN_HURT,
  channel: air ? undefined : RAIN_CHANNEL,
  landingLag: air ? AIR_SPECIAL_LANDING_LAG : undefined,
});





const CHARGE = hit(18.04050064086914, "EDGE", 35, 1.0, HitElement.normal);
const CHARGE_BODY = capsule(-4.0, 127.0, 102.0, -12.0, 40.0);
const chargeMotion = (distance: number): readonly SpecialMotion[] => [
  { ...frames(19, 26), velocityX: perFrame(distance, 19, 26), velocityZ: 0.0, stopsAtBody: true },
  { ...frames(27, 27), velocityX: 0.0, velocityZ: 0.0 },
];
const RUIN_CHARGE: AuthoredSpecial = {
  endFrame: 64,
  regions: [heroRegion(19, 26, CHARGE_BODY, CHARGE)],
  hurt: CHARGE_HURT,
  motion: chargeMotion(h(f32(1.5))),
  armor: { ...frames(19, 24), maxDamage: 6.0 },
};
const RUIN_CHARGE_AIR: AuthoredSpecial = {
  endFrame: 64,
  regions: [heroRegion(19, 26, CHARGE_BODY, CHARGE)],
  hurt: CHARGE_AIR_HURT,
  motion: chargeMotion(h(f32(0.8))),
  oncePerAirtime: true,
  helpless: true,
};





const leap = (rise: number, drift: number, steer: number): SpecialMotion[] => {
  const segment = (first: number, last: number, share: number): SpecialMotion =>
    ({
      ...frames(first, last), velocityX: f32(f32(drift * share) / (last - first + 1)), velocityZ: f32(f32(rise * share) / (last - first + 1)),
      driftSpeed: f32(f32(steer * share) / (last - first + 1)),
    });
  return [segment(13, 18, 0.5), segment(19, 28, f32(0.46)), segment(29, 32, f32(0.04))];
};
const LEAP_HOOF = capsule(10.0, 0.0, 40.0, 40.0, 22.0);
const abyssalLeap = (rise: number, drift: number, steer: number): AuthoredSpecial => ({
  endFrame: 32,
  regions: [heroRegion(13, 18, LEAP_HOOF, hit(12.027000427246094, "LAUNCH", 80, 1.0, HitElement.normal))],
  hurt: LEAP_HURT,
  motion: leap(rise, drift, steer),
  facesStick: true, oncePerAirtime: true, helpless: true,
});



export const HOWL_FIRST = 18;
export const HOWL_REACH = h(f32(1.6));
const HOWL_HEIGHT = h(f32(0.6));
const HOWL_RINGS = [f32(0.5), f32(0.625), f32(0.75), f32(0.875), 1.0] as const;
const HOWL_AIR_LANDING_LAG = 12;
const HOWL_DAMAGE = 4.810800075531006;
const HOWL_HIT = { ...hit(HOWL_DAMAGE, "LINK", 45, 1.0, HitElement.normal), shieldDamage: 21.64859962463379 };
const HOWL_GROUNDED_HIT = { ...HOWL_HIT, growth: 0.0, base: 0.0, launchX: 1.0, launchZ: 0.0, setKnockback: 0.0 };
export const TERRIFIED: NonNullable<AuthoredSpecial["strikeStatus"]> = {
  kind: HeroStatusKind.fear, frames: 30, group: HeroStatusGroup.sleep, immunityFrames: 300,
  perPercent: { frames: 0.4000000059604645, cap: 90 }, groundedOnly: true,
};
const howl = (air: boolean): AuthoredSpecial => ({
  endFrame: 40,
  hurt: air ? HOWL_AIR_HURT : HOWL_HURT,
  regions: HOWL_RINGS.map((share, index) =>
    heroRegion(HOWL_FIRST + index, HOWL_FIRST + index, capsule(0.0, HOWL_HEIGHT, 0.0, HOWL_HEIGHT, f32(HOWL_REACH * share)), HOWL_HIT, HOWL_GROUNDED_HIT)),
  radial: true,
  strikeStatus: TERRIFIED,
  landingLag: air ? HOWL_AIR_LANDING_LAG : undefined,
});

export const PIT_LORD_SPECIALS: FighterSpecials = {
  neutral: { name: "Howl of Terror", description: "Inhale, then roar: a fel shockwave expands on both sides. Grounded foes it reaches cower in terror, longer at higher damage, then resist it for five seconds; airborne foes are pushed away, and a shield takes a heavy blow and a big push instead.", ground: howl(false), air: howl(true) },
  side: { name: "Ruin Charge", description: "A slow charge whose armor shrugs off one light hit; it stops at a shield.", ground: RUIN_CHARGE, air: RUIN_CHARGE_AIR },
  up: { name: "Abyssal Leap", description: "A slow arcing leap you steer, with a hoof strike, then a helpless fall.", ground: abyssalLeap(h(f32(3.5)), h(f32(0.5)), h(f32(1.15))) },
  down: { name: "Rain of Fire", description: "Hold to channel: meteors slant down into a burning patch ahead, a wave every 18 frames, up to four waves. Let go and he recovers; a hit breaks the channel. In the air, one wave.", ground: rain(false), air: rain(true) },
};
