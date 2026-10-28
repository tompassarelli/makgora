import { f32 } from "wisp/src/sim/f32";
import { Character, HitElement, ItemKind } from "./codes";
import { CHILL } from "./chill";
import { heroRegion, type MoveRegion, type StrikeCapsule } from "./heroMoves";
import { FollowUpInput, Relocation, frames, type AuthoredSpecial, type SpecialCompanion, type SpecialCurse, type SpecialPlacement, type SpecialProjectile } from "./specials/schema";
import type { HitEffect } from "./hitRegions";
import { type HurtPart, type HurtPose, hurtPart, hurtPose } from "./hurtboxes";
import type { NamedMove } from "./heroes/hero";
import { ANKH_BURST_MODEL, ANKH_MODEL } from "../../generated/assets/ankhAssetInfo";

// Each fighter's ultimate (docs/design/ultimates.md): ordinary authored special
// data, run by the hero special engine, bought with the whole bar.

const DIRECTION = {
  25: { x: f32(0.906307787), z: f32(0.422618262) },
  30: { x: f32(0.866025404), z: 0.5 },
  40: { x: f32(0.766044443), z: f32(0.642787610) },
  45: { x: f32(0.707106781), z: f32(0.707106781) },
  50: { x: f32(0.642787610), z: f32(0.766044443) },
  55: { x: f32(0.573576436), z: f32(0.819152044) },
  60: { x: 0.5, z: f32(0.866025404) },
  70: { x: f32(0.342020143), z: f32(0.939692621) },
  75: { x: f32(0.258819045), z: f32(0.965925826) },
  80: { x: f32(0.173648178), z: f32(0.984807753) },
  85: { x: f32(0.087155743), z: f32(0.996194698) },
  90: { x: 0.0, z: 1.0 },
} as const;
type Angle = keyof typeof DIRECTION;

function hit(damage: number, angle: Angle, growth: number, base: number, element: HitElement = HitElement.normal, behind = false): HitEffect {
  const direction = DIRECTION[angle];
  return { damage, growth, base, launchX: behind ? -direction.x : direction.x, launchZ: direction.z, electric: element === HitElement.electric, element };
}

const capsule = (x1: number, z1: number, x2: number, z2: number, radius: number): StrikeCapsule => ({ x1, z1, x2, z2, radius });

/** A drawn-only cue: an effect that marks where an ultimate will land and never strikes. */
function mark(model: string, spawnFrame: number, life: number, offsetX: number, offsetZ = 0.0, atFoe = false, expiresInto?: SpecialProjectile): SpecialProjectile {
  return {
    model, spawnFrame, offsetX, offsetZ, velocityX: 0.0, velocityZ: 0.0, life, radius: 1.0, activeFrom: life + 1,
    effect: hit(0.0, 90, 0.0, 0.0), reflectable: false, limit: 4, atFoe, expiresInto,
  };
}

const ON_FLOOR = { dropsToFloor: true } as const;

function shot(spawnFrame: number, offsetX: number, offsetZ: number, velocityX: number, velocityZ: number, life: number, radius: number, effect: HitEffect, model: string): SpecialProjectile {
  return { model, spawnFrame, offsetX, offsetZ, velocityX, velocityZ, life, radius, effect, reflectable: false, limit: 4 };
}

const AIMED_HIT = hit(24.0, 30, 95.0, 40.0);
const AIMED_IMPACT: SpecialProjectile = { ...mark("Abilities\\Weapons\\Bolt\\BoltImpact.mdx", 0, 12, 0.0), radius: 26.0, effect: AIMED_HIT };
const RIFLEMAN: AuthoredSpecial = {
  name: "Aimed Shot", endFrame: 70,
  projectiles: [
    mark("Abilities\\Spells\\Human\\ManaFlare\\ManaFlareTarget.mdx", 4, 32, 60.0, 50.0),
    { ...shot(36, 50.0, 50.0, 60.0, 0.0, 30, 26.0, AIMED_HIT, "Abilities\\Weapons\\CannonTowerMissile\\CannonTowerMissile.mdx"), burstInto: AIMED_IMPACT },
  ],
};

const ILLIDAN: AuthoredSpecial = {
  name: "Metamorphosis", endFrame: 50,
  projectiles: [mark("Objects\\Spawnmodels\\Demon\\DemonLargeDeathExplode\\DemonLargeDeathExplode.mdx", 2, 30, 0.0), mark("Abilities\\Spells\\NightElf\\Immolation\\ImmolationTarget.mdx", 2, 30, 0.0)],
  regions: [heroRegion(31, 33, capsule(-160.0, 60.0, 160.0, 60.0, 70.0), hit(26.0, 70, 80.0, 45.0, HitElement.fire))],
  buff: { frame: 31, kind: ItemKind.speed, frames: 480 },
};

const BLADESTORM_FLOAT_SPEED = f32(4.2);
const BLADESTORM_TICKS = [17, 26, 35, 44, 53, 62] as const;
const BLADESTORM_TICK = hit(2.5, 80, 20.0, 35.0, HitElement.slash);
const BLADESTORM_SWORD: readonly (readonly [number, number, number, number, number])[] = [[17, 74.0, 113.0, 188.0, 121.0], [18, 73.0, 112.0, 189.0, 121.0], [35, -67.0, 108.0, -145.0, 118.0],
  [36, -71.0, 108.0, -157.0, 121.0], [44, -60.0, 114.0, -179.0, 121.0], [45, -54.0, 114.0, -171.0, 121.0]];
const BLADEMASTER: AuthoredSpecial = {
  name: "Bladestorm", endFrame: 104, jumpWindow: frames(17, 74), spellImmune: frames(1, 78), airStall: frames(17, 74), airFloat: { sink: BLADESTORM_FLOAT_SPEED, rise: BLADESTORM_FLOAT_SPEED },
  hurt: [
      hurtPose(1, 8, [hurtPart(0.0, 24.0, -16.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
      hurtPose(9, 16, [hurtPart(0.0, 24.0, 16.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
      hurtPose(17, 24, [hurtPart(0.0, 24.0, 32.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
      hurtPose(25, 32, [hurtPart(0.0, 24.0, 16.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
      hurtPose(33, 40, [hurtPart(0.0, 24.0, -24.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
      hurtPose(41, 48, [hurtPart(0.0, 24.0, -32.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
      hurtPose(49, 56, [hurtPart(0.0, 24.0, -16.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
      hurtPose(57, 64, [hurtPart(0.0, 24.0, 0.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
      hurtPose(65, 72, [hurtPart(0.0, 24.0, 32.0, 125.0, 35.0), hurtPart(-16.0, 95.0, 0.0, 95.0, 25.0)]),
      hurtPose(73, 80, [hurtPart(0.0, 24.0, 32.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
      hurtPose(81, 88, [hurtPart(0.0, 24.0, 0.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
      hurtPose(89, 96, [hurtPart(0.0, 24.0, -32.0, 125.0, 35.0), hurtPart(16.0, 95.0, 0.0, 95.0, 25.0)]),
      hurtPose(97, 103, [hurtPart(0.0, 24.0, -32.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
    ],
  motion: [{ ...frames(17, 74), velocityX: 0.0, velocityZ: 0.0, driftSpeed: 5.0 }, { ...frames(75, 75), velocityX: 0.0, velocityZ: 0.0 }],
  projectiles: [mark("Abilities\\Spells\\Other\\Tornado\\TornadoElementalSmall.mdx", 2, 12, 0.0)],
  regions: [
    ...BLADESTORM_TICKS.map((first): MoveRegion => heroRegion(first, first + 1, capsule(-110.0, 50.0, 110.0, 50.0, 60.0), BLADESTORM_TICK)),
    ...BLADESTORM_SWORD.map(([frame, x1, z1, x2, z2]): MoveRegion => heroRegion(frame, frame, capsule(x1, z1, x2, z2, 6.0), BLADESTORM_TICK)),
    heroRegion(75, 78, capsule(-120.0, 60.0, 120.0, 60.0, 70.0), hit(9.0, 45, 95.0, 50.0, HitElement.slash)),
  ],
  rehits: [...BLADESTORM_TICKS, 75],
};

const MOUNTAIN_KING: AuthoredSpecial = {
  name: "Avatar", endFrame: 50,
  projectiles: [mark("Abilities\\Spells\\Human\\Avatar\\AvatarCaster.mdx", 16, 34, 0.0), mark("Abilities\\Spells\\Human\\Thunderclap\\ThunderClapCaster.mdx", 33, 14, 0.0)],
  regions: [heroRegion(33, 35, capsule(-180.0, 30.0, 180.0, 30.0, 50.0), hit(26.0, 75, 75.0, 40.0))],
  buff: { frame: 33, kind: ItemKind.heavy, frames: 600 },
};

const WARDEN: AuthoredSpecial = {
  name: "Vengeance", endFrame: 40,
  placement: {
    frame: 22, offsetX: -60.0, radius: 40.0, height: 140.0, durability: 30.0, life: 90, fireAges: [2, 17, 32, 47],
    shot: shot(0, 40.0, 50.0, 18.0, 0.0, 50, 26.0, hit(6.5, 40, 60.0, 30.0, HitElement.slash), "Abilities\\Weapons\\SpiritOfVengeanceMissile\\SpiritOfVengeanceMissile.mdx"),
    model: { path: "Units\\NightElf\\SpiritOfVengeance\\SpiritOfVengeance.mdx", height: 150.0, alpha: 255 },
  },
};

const LICH: AuthoredSpecial = {
  name: "Frost Wyrm", endFrame: 60,
  projectiles: [
    mark("Abilities\\Spells\\Undead\\FreezingBreath\\FreezingBreathTargetArt.mdx", 2, 29, -600.0, 95.0),
    { ...shot(31, -600.0, 95.0, 28.0, 0.0, 70, 45.0, hit(26.0, 60, 85.0, 45.0, HitElement.ice), "Abilities\\Weapons\\FrostWyrmMissile\\FrostWyrmMissile.mdx"), status: CHILL },
  ],
};

const RESURRECTION_RING = "Abilities\\Spells\\Human\\Resurrect\\ResurrectTarget.mdx";
const UTHER: AuthoredSpecial = {
  name: "Resurrection", endFrame: 64,
  projectiles: [
    { ...mark("Abilities\\Spells\\Human\\Resurrect\\ResurrectCaster.mdx", 2, 24, 0.0), ...ON_FLOOR },
    ...[-150.0, -80.0, 80.0, 150.0].map((offsetX) => ({ ...mark(RESURRECTION_RING, 25, 24, offsetX), ...ON_FLOOR })),
  ],
  regions: [
    heroRegion(26, 28, capsule(-170.0, 20.0, 170.0, 20.0, 45.0), hit(14.0, 85, 60.0, 50.0, HitElement.holy)),
    heroRegion(34, 36, capsule(-170.0, 70.0, 170.0, 70.0, 55.0), hit(12.0, 90, 88.0, 50.0, HitElement.holy)),
  ],
  rehits: [34],
};

const INFERNAL_RADIUS = 50.0;
const INFERNO_MARK = { ...mark("Abilities\\Spells\\Human\\MarkOfChaos\\MarkOfChaosTarget.mdx", 4, 37, 260.0), ...ON_FLOOR, ledgeInset: INFERNAL_RADIUS };
const INFERNO_CRASH = { ...mark("Abilities\\Spells\\Other\\Incinerate\\FireLordDeathExplode.mdx", 40, 14, 0.0), atMark: INFERNO_MARK };
const INFERNAL_IMMOLATION: SpecialProjectile = shot(0, 0.0, 70.0, 0.0, 0.0, 6, 75.0, hit(0.5, 70, 15.0, 20.0, HitElement.fire), "Abilities\\Weapons\\DemolisherFireMissile\\DemolisherFireMissile.mdx");
const INFERNAL: SpecialCompanion = {
  followSpeed: 2.5, followBehind: 80.0, returnSpeed: 4.0, engage: 120.0,
  lungeStartup: 16, lungeActive: 6, lungeRecovery: 44, lungeTravel: 50.0,
  bite: capsule(10.0, 30.0, 120.0, 60.0, 55.0), biteEffect: hit(3.0, 45, 72.0, 40.0, HitElement.fire),
  stunFrames: 24, leash: 900.0, leashFrames: 120,
};
const INFERNAL_PLACEMENT: SpecialPlacement = {
  frame: 40, offsetX: 0.0, radius: INFERNAL_RADIUS, height: 170.0, durability: 30.0, life: 300,
  fireAges: [30, 60, 90, 120, 150, 180, 210, 240, 270], shot: INFERNAL_IMMOLATION, aura: true, atMark: INFERNO_MARK, companion: INFERNAL,
  model: { path: "Units\\Demon\\Infernal\\Infernal.mdl", height: 240.0, alpha: 255 },
};
const DREADLORD: AuthoredSpecial = {
  name: "Summon Inferno", endFrame: 56,
  projectiles: [
    INFERNO_MARK,
    { ...mark("Abilities\\Weapons\\DemolisherFireMissile\\DemolisherFireMissile.mdx", 28, 12, 0.0, 600.0), velocityZ: -48.0, atMark: INFERNO_MARK },
    INFERNO_CRASH,
  ],
  regions: [heroRegion(40, 42, capsule(0.0, 20.0, 0.0, 120.0, 100.0), hit(14.0, 80, 90.0, 45.0, HitElement.fire))],
  regionOrigin: INFERNO_CRASH,
  placement: INFERNAL_PLACEMENT,
};

const VOODOO_AURA = "Abilities\\Spells\\Orc\\Voodoo\\VoodooAura.mdx";
const VOODOO_WARD_MARK = "Abilities\\Spells\\Orc\\Voodoo\\VoodooAuraTarget.mdx";
const VOODOO_BOLT = "Abilities\\Weapons\\SerpentWardMissile\\SerpentWardMissile.mdx";
const VOODOO_END = 105;
const VOODOO_WARD_FRAME = 16;
const voodooBolt = (effect: HitEffect): SpecialProjectile => ({ ...shot(0, 30.0, 50.0, 14.0, 0.0, 24, 26.0, effect, VOODOO_BOLT), modelRadius: 13.0 });
const SHADOW_HUNTER: AuthoredSpecial = {
  name: "Big Bad Voodoo", endFrame: VOODOO_END,
  projectiles: [{ ...mark(VOODOO_AURA, 2, VOODOO_END - 2, 0.0), cancelOnInterrupt: true }],
  placement: {
    frame: VOODOO_WARD_FRAME, slot: 1, offsetX: 140.0, radius: 30.0, height: 130.0, durability: 1.0, life: VOODOO_END - VOODOO_WARD_FRAME + 1,
    fireAges: [7, 22, 37, 52], outwardPair: true, channeled: true,
    shot: voodooBolt(hit(5.0, 40, 20.0, 30.0, HitElement.poison)),
    finalShot: voodooBolt(hit(12.0, 45, 90.0, 60.0, HitElement.poison)),
    mark: { ...mark(VOODOO_WARD_MARK, 0, VOODOO_END - VOODOO_WARD_FRAME, 0.0), cancelOnInterrupt: true },
  },
};

const DOOM_GUARD_WAVE: SpecialProjectile = shot(0, 70.0, 20.0, 8.0, 0.0, 30, 34.0, hit(6.0, 60, 60.0, 40.0, HitElement.fire), "Abilities\\Weapons\\DemolisherFireMissile\\DemolisherFireMissile.mdx");
const DOOM_GUARD: SpecialCompanion = { followSpeed: 2.0, followBehind: 80.0, returnSpeed: 3.0, engage: 150.0, lungeStartup: 26, lungeActive: 6, lungeRecovery: 58, lungeTravel: 30.0, waveFrame: 32, bite: capsule(20.0, 30.0, 160.0, 90.0, 60.0), biteEffect: hit(14.0, 40, 85.0, 50.0, HitElement.slash), stunFrames: 40, leash: 4000.0, leashFrames: 600, };
const DOOM: SpecialCurse = {
  every: 60, damage: 1.0, summonDelay: 60, portal: { ...mark("Abilities\\Spells\\Demon\\DarkPortal\\DarkPortalTarget.mdx", 0, 77, 0.0), ...ON_FLOOR },
  summon: { frame: 0, offsetX: 0.0, radius: 50.0, height: 220.0, durability: 40.0, life: 480, fireAges: [], shot: DOOM_GUARD_WAVE, companion: DOOM_GUARD, model: { path: "Units\\Demon\\DoomGuard\\DoomGuard.mdl", height: 260.0, alpha: 255 }, },
};
const PIT_LORD: AuthoredSpecial = {
  name: "Doom", endFrame: 60, armor: { ...frames(1, 20), knockback: 100.0 },
  targetedStrike: { range: 600.0, frame: 20, effect: hit(10.0, 85, 30.0, 40.0, HitElement.fire), curse: DOOM,
    glyph: mark("Abilities\\Spells\\Other\\Doom\\DoomTarget.mdx", 0, 20, 0.0, 150.0), bolt: mark("Abilities\\Spells\\Other\\Doom\\DoomDeath.mdx", 0, 30, 0.0) },
};

const BEASTMASTER: AuthoredSpecial = {
  name: "Stampede", endFrame: 70, groundOnly: true,
  projectiles: [
    mark("Abilities\\Spells\\Other\\Stampede\\StampedeMissileDeath.mdx", 2, 22, -100.0),
    shot(25, -150.0, 25.0, 22.0, 0.0, 60, 30.0, hit(13.0, 40, 80.0, 40.0), "units\\creeps\\QuillBeast\\QuillBeast.mdl"),
    shot(40, -150.0, 70.0, 22.0, 0.0, 60, 45.0, hit(13.0, 40, 80.0, 40.0), "units\\creeps\\GrizzlyBear\\GrizzlyBear.mdl"),
    shot(55, -150.0, 190.0, 22.0, 0.0, 60, 30.0, hit(13.0, 40, 80.0, 40.0), "units\\creeps\\WarEagle\\WarEagle.mdl"),
  ],
};

const RISEN = shot(0, 0.0, 40.0, 0.0, 0.0, 4, 90.0, hit(26.0, 85, 90.0, 45.0, HitElement.dark), "Abilities\\Spells\\Undead\\Impale\\ImpaleHitTarget.mdx");
const LICH_KING: AuthoredSpecial = {
  name: "Animate Dead", endFrame: 56,
  projectiles: [mark("Abilities\\Spells\\Undead\\AnimateDead\\AnimateDeadTarget.mdx", 2, 30, 0.0, 0.0, true, RISEN)],
};

const tremor = (direction: number): SpecialProjectile => ({
  ...shot(27, direction * 40.0, 25.0, direction * 16.0, 0.0, 50, 50.0, hit(26.0, 70, 85.0, 40.0), "Abilities\\Spells\\Orc\\Shockwave\\ShockwaveMissile.mdx"),
  pool: { every: 60, growth: 0.0, maxRadius: 50.0 },
});
const THRALL: AuthoredSpecial = {
  name: "Earthquake", endFrame: 60, groundOnly: true,
  projectiles: [mark("Abilities\\Spells\\Orc\\EarthQuake\\EarthquakeTarget.mdx", 2, 25, 0.0), tremor(1.0), tremor(-1.0)],
};

const ray = (spawnFrame: number, velocityX: number, velocityZ: number, effect: HitEffect): SpecialProjectile =>
  shot(spawnFrame, 40.0, 90.0, velocityX, velocityZ, 15, 30.0, effect, "Abilities\\Spells\\Other\\FrostBolt\\FrostBoltMissile.mdx");
const GLANCE = hit(5.0, 30, 30.0, 25.0, HitElement.ice);
const JAINA: AuthoredSpecial = {
  name: "Glacial Ray", endFrame: 80,
  projectiles: [
    mark("Abilities\\Spells\\Undead\\FreezingBreath\\FreezingBreathTargetArt.mdx", 2, 22, 40.0, 90.0),
    ray(25, f32(28.284271), f32(28.284271), GLANCE),
    ray(33, f32(37.587704), f32(13.680806), GLANCE),
    ray(41, 40.0, 0.0, GLANCE),
    ray(49, f32(39.392310), f32(-6.945927), hit(10.0, 30, 90.0, 45.0, HitElement.ice)),
  ],
};

const BANSHEE_SPEED = 9.0;
const BANSHEE_TURN = { turnCos: f32(0.9902680687415704), turnSin: f32(0.13917310096006544) };
const BANSHEE_CARRY_SPEED = 20.0;
const BANSHEE_CARRY: AuthoredSpecial = {
  endFrame: 35,
  motion: [{ ...frames(1, 14), velocityX: 0.0, velocityZ: 0.0, seek: { speed: BANSHEE_CARRY_SPEED, turnCos: 1.0, turnSin: 0.0 } }, { ...frames(15, 15), velocityX: 0.0, velocityZ: 0.0 }],
  intangible: frames(1, 14),
};
const SYLVANAS: AuthoredSpecial = {
  name: "Banshee Form", endFrame: 128,
  projectiles: [mark("Abilities\\Spells\\Undead\\Possession\\PossessionCaster.mdx", 2, 17, 0.0)],
  motion: [
    { ...frames(1, 17), velocityX: 0.0, velocityZ: 1.0 },
    { ...frames(18, 18), velocityX: 1.0, velocityZ: 0.0 },
    { ...frames(19, 98), velocityX: 0.0, velocityZ: 0.0, seek: { speed: BANSHEE_SPEED, ...BANSHEE_TURN } },
    { ...frames(99, 99), velocityX: 0.0, velocityZ: 0.0 },
  ],
  intangible: frames(19, 98),
  regions: [heroRegion(19, 98, capsule(0.0, 45.0, 0.0, 75.0, 32.0), hit(26.0, 45, 72.0, 45.0, HitElement.dark))],
  followUps: [{ window: frames(19, 99), input: FollowUpInput.contact, special: BANSHEE_CARRY }],
  refreshesAir: true,
};

const CAIRNE_ANKH: SpecialProjectile = {
  ...mark(ANKH_MODEL, 1, 36, 0.0), atStageCentre: true, cancelOnInterrupt: true, modelRadius: f32(0.625),
};
const CAIRNE: AuthoredSpecial = {
  name: "Reincarnation", endFrame: 58,
  projectiles: [
    CAIRNE_ANKH,
    { ...mark("Abilities\\Spells\\Human\\Resurrect\\ResurrectTarget.mdx", 25, 10, 0.0), atStageCentre: true, cancelOnInterrupt: true },
    { ...mark("Abilities\\Spells\\Human\\HolyBolt\\HolyBoltSpecialArt.mdx", 25, 16, 0.0), atStageCentre: true, cancelOnInterrupt: true, modelRadius: f32(0.625) },
    { ...mark(ANKH_BURST_MODEL, 25, 12, 0.0, 60.0), atStageCentre: true, cancelOnInterrupt: true },
    { ...mark("Abilities\\Spells\\Human\\MassTeleport\\MassTeleportCaster.mdx", 28, 24, 0.0), cancelOnInterrupt: true },
  ],
  regionOrigin: CAIRNE_ANKH,
  regions: [heroRegion(25, 27, capsule(-140.0, 50.0, 140.0, 50.0, 50.0), hit(26.0, 85, 60.0, 55.0, HitElement.holy))],
  motion: [{ ...frames(34, 34), velocityX: 0.0, velocityZ: 0.0, relocateProjectile: CAIRNE_ANKH }],
  // The engine primes intangibility one frame ahead, so arrival protection starts at teleport frame 34.
  intangible: frames(35, 39),
};

const SPIRIT_LOOK = { height: 210.0, alpha: 255, casts: true } as const;
const SPIRIT = { radius: 40.0, height: 150.0, durability: 1.0, life: 270, crumble: 20 } as const;
export const EARTH_SPIRIT: SpecialPlacement = { ...SPIRIT, frame: 12, offsetX: 240.0, fireAges: [30], shot: mark("Abilities\\Spells\\NightElf\\Taunt\\TauntCaster.mdx", 0, 30, 0.0, 90.0), taunt: { radius: 240.0, pull: 3.0 }, model: { ...SPIRIT_LOOK, path: "units\\creeps\\EarthPandarenBrewmaster\\EarthPandarenBrewmaster.mdl" } };
const CYCLONE = hit(3.0, 90, 15.0, 80.0);
export const STORM_SPIRIT: SpecialPlacement = {
  ...SPIRIT, frame: 20, slot: 1, offsetX: -130.0, radius: 35.0, fireAges: [40, 130, 220], windWalk: { frames: 45, hop: 160.0 }, model: { ...SPIRIT_LOOK, path: "units\\creeps\\StormPandarenBrewmaster\\StormPandarenBrewmaster.mdl" },
  shot: { ...shot(0, 60.0, 50.0, 4.0, 0.0, 70, 50.0, CYCLONE, "Abilities\\Spells\\NightElf\\Cyclone\\CycloneTarget.mdx"), pool: { every: 12, growth: 0.0, maxRadius: 50.0 } },
};
const IMMOLATION = shot(0, 0.0, 50.0, 0.0, 0.0, 8, 120.0, hit(13.0, 70, 85.0, 45.0, HitElement.fire), "Abilities\\Spells\\Other\\Incinerate\\FireLordDeathExplode.mdx");
export const FIRE_SPIRIT: SpecialPlacement = { ...SPIRIT, frame: 28, slot: 2, offsetX: 120.0, durability: 20.0, fireAges: [45, 165], aura: true, shot: IMMOLATION, model: { ...SPIRIT_LOOK, path: "units\\creeps\\FirePandarenBrewmaster\\FirePandarenBrewmaster.mdl" } };
const CHEN: AuthoredSpecial = {
  name: "Storm, Earth and Fire", endFrame: 48, groundOnly: true,
  projectiles: [mark("Abilities\\Spells\\Orc\\FeralSpirit\\FeralSpiritTarget.mdx", 2, 26, 0.0)],
  placement: EARTH_SPIRIT, summons: [STORM_SPIRIT, FIRE_SPIRIT],
};

const WATCH_TOWER_MODEL = "buildings\\orc\\WatchTower\\WatchTower.mdx";
const TOWER_ARROW: SpecialProjectile = {
  ...shot(0, 30.0, 95.0, 26.0, 0.0, 26, 18.0, hit(1.5, 40, 15.0, 30.0), "Abilities\\Weapons\\GuardTowerMissile\\GuardTowerMissile.mdx"),
  homing: { turn: 3.0, maxRise: 14.0 },
};
const PEON: AuthoredSpecial = {
  name: "Tower Rush", endFrame: 70, groundOnly: true,
  placement: {
    frame: 16, slot: 1, offsetX: 0.0, radius: 40.0, height: 150.0, durability: 10.0, life: 180, crumble: 30,
    fireAges: [20, 60, 100, 140], spread: { offsets: [110.0, 250.0, -130.0, 390.0, 530.0], every: 8 }, aimed: true,
    shot: TOWER_ARROW,
    model: { path: WATCH_TOWER_MODEL, height: 220.0, alpha: 255 },
  },
};

const OVERDRIVE_BLAST = shot(0, 0.0, 30.0, 0.0, 0.0, 4, 150.0, hit(23.0, 55, 90.0, 45.0, HitElement.fire), "Objects\\Spawnmodels\\Other\\NeutralBuildingExplosion\\NeutralBuildingExplosion.mdx");
const TINKER: AuthoredSpecial = {
  name: "Robo-Goblin Overdrive", endFrame: 50, needsFloorBelow: true,
  projectiles: [{ ...shot(20, 60.0, 30.0, 6.0, 0.0, 60, 40.0, hit(3.0, 30, 20.0, 30.0), "Units\\Creeps\\HeroTinkerRobot\\HeroTinkerRobot.mdl"), expiresInto: OVERDRIVE_BLAST, ...ON_FLOOR }],
};

const PHOENIX_BURN = hit(4.338719844818115, 70, 38.02436065673828, 30.0, HitElement.fire);
const SUMMONED_PHOENIX: SpecialCompanion = {
  behavior: "flying", followSpeed: 9.0, followBehind: -60.0, followHeight: 110.0, returnSpeed: 12.0,
  lungeStartup: 6, lungeActive: 6, lungeRecovery: 20, lungeTravel: 0.0, bite: capsule(-20.0, 0.0, 20.0, 0.0, 30.0), biteEffect: PHOENIX_BURN,
  stunFrames: 30, leash: 600.0, leashFrames: 60,
};
export const SUMMON_PHOENIX_FRAME = 20;
const KAELTHAS: AuthoredSpecial = {
  name: "Summon Phoenix", endFrame: 36, projectiles: [mark("Abilities\\Spells\\Human\\FlameStrike\\FlameStrikeEmbers.mdx", 2, SUMMON_PHOENIX_FRAME - 2, -40.0, 110.0)],
  placement: {
    frame: SUMMON_PHOENIX_FRAME, offsetX: -40.0, offsetZ: 110.0, radius: 30.0, height: 60.0, durability: 12.0, life: 180, fireAges: [30, 60, 90, 120, 150, 178],
    shot: { ...shot(0, 0.0, 0.0, 0.0, 0.0, 6, 70.0, PHOENIX_BURN, "Abilities\\Weapons\\DemolisherFireMissile\\DemolisherFireMissile.mdx"), limit: 3 }, companion: SUMMONED_PHOENIX,
    model: { path: "units\\human\\Phoenix\\Phoenix.mdl", height: 110.0, alpha: 255 },
  },
};

const MURLOC_MODEL = "units\\creeps\\Murloc\\Murloc.mdl";
const swarm = (offsetX: number): SpecialProjectile => ({
  ...shot(20, offsetX, 20.0, 30.0, 0.0, 45, 40.0, hit(4.0, 25, 10.0, 30.0), MURLOC_MODEL),
  pool: { every: 6, growth: 0.0, maxRadius: 40.0 }, modelRadius: 70.0,
});
const MURLOC: AuthoredSpecial = {
  name: "Mrglglgl Stampede", endFrame: 70, groundOnly: true,
  projectiles: [
    mark("Abilities\\Spells\\Other\\CrushingWave\\CrushingWaveDamage.mdx", 2, 18, -520.0),
    swarm(-520.0), swarm(-560.0), swarm(-600.0),
    { ...shot(20, -660.0, 20.0, 30.0, 0.0, 45, 40.0, hit(22.0, 40, 90.0, 45.0), MURLOC_MODEL), modelRadius: 70.0 },
  ],
};

const part = (x1: number, z1: number, x2: number, z2: number, radius: number): HurtPart => ({ x1, z1, x2, z2, radius });
const pose = (firstFrame: number, lastFrame: number, parts: readonly HurtPart[]): HurtPose => ({ firstFrame, lastFrame, parts });

const GROM: AuthoredSpecial = {
  name: "Blood of Mannoroth", endFrame: 70,
  projectiles: [mark("Abilities\\Spells\\Orc\\Bloodlust\\BloodlustTarget.mdx", 1, 16, 0.0)],
  motion: [{ ...frames(17, 40), velocityX: 22.0, velocityZ: 0.0 }, { ...frames(41, 41), velocityX: 0.0, velocityZ: 0.0 }],
  commandGrab: { ...frames(17, 40), strike: capsule(20.0, 50.0, 70.0, 50.0, 40.0), holdFrames: 30, effect: hit(26.0, 40, 90.0, 45.0, HitElement.slash), recovery: 24 },
  hurt: [
    pose(1, 7, [part(-14.0, -8.0, -34.0, 141.0, 48.0)]),
    pose(8, 13, [part(-18.0, 28.0, -26.0, 52.0, 27.0), part(-58.0, 104.0, -58.0, 104.0, 36.0), part(-94.0, 132.0, -94.0, 169.0, 20.0)]),
    pose(14, 16, [part(-18.0, 21.0, 6.0, 62.0, 44.0), part(9.0, 90.0, 9.0, 124.0, 18.0), part(-18.0, 141.0, -59.0, 170.0, 25.0)]),
    pose(17, 57, [part(41.0, 13.0, -16.0, 160.0, 37.0)]),
    pose(58, 69, [part(17.0, 22.0, -45.0, 160.0, 37.0)]),
  ],
};

const LOCUST = "Units\\Undead\\Locust\\Locust.mdx";
const ANUBARAK: AuthoredSpecial = {
  name: "Locust Swarm", endFrame: 60, groundOnly: true,
  projectiles: [
    { ...shot(17, 60.0, 60.0, 5.0, 0.0, 90, 90.0, hit(6.5, 80, 10.0, 25.0, HitElement.poison), LOCUST), pool: { every: 12, growth: 0.0, maxRadius: 90.0 } },
    ...[{ x: 5.0, z: 105.0 }, { x: 115.0, z: 85.0 }, { x: 95.0, z: 15.0 }].map(({ x, z }) => ({ ...mark(LOCUST, 17, 90, x, z), velocityX: 5.0 })),
  ],
};

const MALFURION: AuthoredSpecial = {
  name: "Wisps of Hyjal", endFrame: 50,
  projectiles: [
    mark("Abilities\\Spells\\NightElf\\Tranquility\\TranquilityTarget.mdx", 2, 26, 0.0),
    shot(29, 60.0, 70.0, 7.0, 0.0, 120, 70.0, hit(26.0, 50, 90.0, 45.0, HitElement.holy), "Units\\NightElf\\Wisp\\Wisp.mdx"),
  ],
};

const PULL = [25, 37, 49] as const;
const DARK_PORTAL = { ...mark("Abilities\\Spells\\Demon\\DarkPortal\\DarkPortalTarget.mdx", 2, 77, 240.0), ...ON_FLOOR };
const MEDIVH: AuthoredSpecial = {
  name: "The Dark Portal", endFrame: 70,
  projectiles: [DARK_PORTAL],
  regionOrigin: DARK_PORTAL,
  regions: [
    ...PULL.flatMap((first): MoveRegion[] => [
      heroRegion(first, first, capsule(-200.0, 50.0, -40.0, 50.0, 80.0), hit(1.0, 25, 0.0, 30.0, HitElement.dark)),
      heroRegion(first, first, capsule(40.0, 50.0, 200.0, 50.0, 80.0), hit(1.0, 25, 0.0, 30.0, HitElement.dark, true)),
    ]),
    heroRegion(64, 66, capsule(0.0, 20.0, 0.0, 120.0, 110.0), hit(23.0, 60, 90.0, 45.0, HitElement.dark)),
  ],
  rehits: [...PULL, 64],
};


const LADY_VASHJ: AuthoredSpecial = {
  name: "Gaze of Azshara", endFrame: 72,
  projectiles: [mark("Abilities\\Spells\\Undead\\Curse\\CurseTarget.mdx", 1, 20, 18.0, 150.0)],
  gaze: { window: frames(21, 60), range: 600.0, height: 300.0, slow: { ...CHILL, frames: 40, immunityFrames: 0 } },
};

const CHAOS_MARK = "Abilities\\Spells\\Human\\MarkOfChaos\\MarkOfChaosTarget.mdx";
const CHAOS_CENTRE = mark(CHAOS_MARK, 2, 64, 0.0, 0.0, true);
const CHAOS_AHEAD: SpecialProjectile = { ...mark(CHAOS_MARK, 3, 63, 220.0), atMark: CHAOS_CENTRE };
const CHAOS_BEHIND: SpecialProjectile = { ...mark(CHAOS_MARK, 3, 63, -220.0), atMark: CHAOS_CENTRE };
const INFERNAL_CRASH_MODEL = "Units\\Demon\\Infernal\\InfernalBirth.mdl";
const ARCHIMONDE: AuthoredSpecial = {
  name: "Rain of Chaos", endFrame: 72,
  projectiles: [
    CHAOS_CENTRE, CHAOS_AHEAD, CHAOS_BEHIND,
    { ...shot(42, 0.0, 40.0, 0.0, 0.0, 8, 75.0, hit(8.0, 80, 40.0, 45.0, HitElement.fire), INFERNAL_CRASH_MODEL), atMark: CHAOS_CENTRE },
    { ...shot(50, 0.0, 40.0, 0.0, 0.0, 8, 75.0, hit(8.0, 80, 40.0, 45.0, HitElement.fire), INFERNAL_CRASH_MODEL), atMark: CHAOS_AHEAD },
    { ...shot(58, 0.0, 40.0, 0.0, 0.0, 8, 75.0, hit(10.0, 70, 90.0, 45.0, HitElement.fire), INFERNAL_CRASH_MODEL), atMark: CHAOS_BEHIND },
  ],
};

/** Every fighter's ultimate, by character. */
export const FIGHTER_ULTIMATES: { readonly [character: number]: AuthoredSpecial | undefined } = {
  [Character.rifleman]: RIFLEMAN,
  [Character.demonHunter]: ILLIDAN,
  [Character.blademaster]: BLADEMASTER,
  [Character.mountainKing]: MOUNTAIN_KING,
  [Character.warden]: WARDEN,
  [Character.lich]: LICH,
  [Character.dreadlord]: DREADLORD,
  [Character.shadowHunter]: SHADOW_HUNTER,
  [Character.pitLord]: PIT_LORD,
  [Character.beastmaster]: BEASTMASTER,
  [Character.lichKing]: LICH_KING,
  [Character.thrall]: THRALL,
  [Character.jaina]: JAINA,
  [Character.sylvanas]: SYLVANAS,
  [Character.cairne]: CAIRNE,
  [Character.chen]: CHEN,
  [Character.peon]: PEON,
  [Character.tinker]: TINKER,
  [Character.kaelthas]: KAELTHAS,
  [Character.murloc]: MURLOC,
  [Character.grom]: GROM,
  [Character.anubarak]: ANUBARAK,
  [Character.malfurion]: MALFURION,
  [Character.medivh]: MEDIVH,
  [Character.uther]: UTHER,
  [Character.ladyVashj]: LADY_VASHJ,
  [Character.archimonde]: ARCHIMONDE,
};

const ULTIMATE_DESCRIPTIONS: { readonly [character: number]: string | undefined } = {
  [Character.rifleman]: "Kneel and aim: a red line shows the shot, then one bullet crosses the stage. Jump or shield it.",
  [Character.demonHunter]: "Fel fire burns around him as he becomes a demon: a burst launches nearby foes, then he moves faster for 8 seconds.",
  [Character.blademaster]: "A steerable whirlwind of cuts ending in a strong slash, then he is dizzy. He can jump while it spins and no opponent special or ultimate affects him until it ends. Shield or outrun it.",
  [Character.mountainKing]: "He turns to stone with a stomp: heavier for 10 seconds. Hit him while he changes.",
  [Character.warden]: "The Avatar of Vengeance rises behind her and throws four ghostly glaives. Break it or dodge the glaives.",
  [Character.lich]: "A frost wyrm sweeps straight ahead at body height. Jump or shield it.",
  [Character.dreadlord]: "An Infernal crashes onto a burning mark ahead, then fights at your side. Break it or keep away from its flames.",
  [Character.shadowHunter]: "He dances while two serpent wards beside him spit bolts outward, then a launcher. The wards can't be hurt; hit him to end the dance and sink them.",
  [Character.pitLord]: "Marks the nearest foe in range with Doom, then a fel bolt lands on them through any shield: they burn 1% a second until they lose a stock, then a Doom Guard steps out of a fel portal where they fell and fights for him. Dodge as the bolt lands or get out of range; smash him through his armor; kill him first to lift the curse.",
  [Character.beastmaster]: "His pack stampedes past: a low quilbeast, a bear, then a high hawk. Jump, shield, then stay low.",
  [Character.lichKing]: "Runes mark the ground under the nearest foe; the dead claw up there a moment later. Step off the mark.",
  [Character.thrall]: "Tremors run along the ground both ways. Jump them or stand on a platform.",
  [Character.jaina]: "A ray of frost sweeps down from high ahead of her to the floor. Get behind her or shield.",
  [Character.sylvanas]: "She becomes a banshee, glides low at the nearest foe, swings back round after them and passes through them. Hit her while she changes; shield, roll through her late or run away.",
  [Character.cairne]: "An ankh appears at centre stage. After 24 frames it bursts; 9 frames later he teleports there with 6 frames of intangibility. Shield or leave the ankh; punish his arrival recovery.",
  [Character.chen]: "He calls Earth, Storm and Fire one after another. Earth draws foes in and breaks on one hit; Storm sends cyclones and Wind Walks away when struck; Fire bursts twice. Hit Earth, outlast them or keep away.",
  [Character.peon]: "He builds five Orc watch towers in quick succession across the stage; each shoots arrows at the nearest foe for about three seconds, then crumbles. Break a tower, shield or dodge the arrows, or hit him while he builds.",
  [Character.tinker]: "His Robo-Goblin waddles ahead and explodes. Walk away or shield the blast.",
  [Character.kaelthas]: "Embers gather behind him and a phoenix rises at his shoulder, follows him and burns anyone near it. Break it or keep away from its flames.",
  [Character.murloc]: "He blows a conch and a swarm of murlocs pours across the ground. Jump over it or shield.",
  [Character.grom]: "Demon blood drives a charge that catches the first foe, through a shield, for three Gorehowl chops. Jump it.",
  [Character.anubarak]: "A slow cloud of beetles drifts ahead, stinging anyone standing in it. Jump or shield.",
  [Character.malfurion]: "A slow wall of wisps drifts forward and detonates on whoever it reaches.",
  [Character.medivh]: "A dark portal opens ahead, drawing foes in, then erupts. Walk away before it bursts.",
  [Character.uther]: "Golden light gathers around him, then rings of it rise on both sides and throw everyone near him upward. Shield or roll away during the gathering.",
  [Character.ladyVashj]: "Her eyes and head snakes glow, then her gaze sweeps a cone ahead: a foe facing her slows, then turns to stone and takes hits without flying until it ends. Turn away from her.",
  [Character.archimonde]: "Fel circles mark the foe and the ground on both sides of them; three infernals crash down one after another. Leave the circles.",
};

/** The ultimate's official name and one-line description, for the move list and Moves page. */
export function ultimateText(character: number): NamedMove | undefined {
  const move = FIGHTER_ULTIMATES[character];
  const description = ULTIMATE_DESCRIPTIONS[character];
  return move?.name === undefined || description === undefined ? undefined : { name: move.name, description };
}
