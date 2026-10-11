import { f32 } from "wisp/src/sim/f32";
import { Character, HeroStatusGroup, HeroStatusKind, HitElement, ItemKind } from "./codes";
import { CHILL } from "./chill";
import { heroRegion, type MoveRegion, type StrikeCapsule } from "./heroMoves";
import { FollowUpInput, frames, type AuthoredSpecial, type SpecialProjectile } from "./heroSpecials";
import type { AppliedStatus } from "./heroStatus";
import type { HitEffect } from "./hitRegions";
import { type HurtPart, type HurtPose, hurtPart, hurtPose } from "./hurtboxes";
import type { NamedMove } from "./heroes/hero";

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

function shot(spawnFrame: number, offsetX: number, offsetZ: number, velocityX: number, velocityZ: number, life: number, radius: number, effect: HitEffect, model: string): SpecialProjectile {
  return { model, spawnFrame, offsetX, offsetZ, velocityX, velocityZ, life, radius, effect, reflectable: false, limit: 4 };
}

const AIMED_HIT = hit(24.0, 30, 95.0, 40.0);
const AIMED_IMPACT: SpecialProjectile = { ...mark("Abilities\\Weapons\\Bolt\\BoltImpact.mdx", 0, 12, 0.0), radius: 26.0, effect: AIMED_HIT };
const RIFLEMAN: AuthoredSpecial = {
  name: "Aimed Shot", endFrame: 70, groundOnly: true,
  projectiles: [
    mark("Abilities\\Spells\\Human\\ManaFlare\\ManaFlareTarget.mdx", 4, 32, 60.0, 50.0),
    { ...shot(36, 50.0, 50.0, 60.0, 0.0, 30, 26.0, AIMED_HIT, "Abilities\\Weapons\\CannonTowerMissile\\CannonTowerMissile.mdx"), burstInto: AIMED_IMPACT },
  ],
};

const ILLIDAN: AuthoredSpecial = {
  name: "Metamorphosis", endFrame: 50, groundOnly: true,
  projectiles: [mark("Objects\\Spawnmodels\\Demon\\DemonLargeDeathExplode\\DemonLargeDeathExplode.mdx", 2, 30, 0.0), mark("Abilities\\Spells\\NightElf\\Immolation\\ImmolationTarget.mdx", 2, 30, 0.0)],
  regions: [heroRegion(31, 33, capsule(-160.0, 60.0, 160.0, 60.0, 70.0), hit(12.0, 70, 80.0, 45.0, HitElement.fire))],
  buff: { frame: 31, kind: ItemKind.speed, frames: 480 },
};

const BLADESTORM_TICKS = [17, 26, 35, 44, 53, 62] as const;
const BLADEMASTER: AuthoredSpecial = {
  name: "Bladestorm", endFrame: 104, groundOnly: true,
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
    ...BLADESTORM_TICKS.map((first): MoveRegion => heroRegion(first, first + 1, capsule(-110.0, 50.0, 110.0, 50.0, 60.0), hit(2.5, 80, 20.0, 35.0, HitElement.slash))),
    heroRegion(75, 78, capsule(-120.0, 60.0, 120.0, 60.0, 70.0), hit(9.0, 45, 95.0, 50.0, HitElement.slash)),
  ],
  rehits: [...BLADESTORM_TICKS, 75],
};

const MOUNTAIN_KING: AuthoredSpecial = {
  name: "Avatar", endFrame: 50, groundOnly: true,
  projectiles: [mark("Abilities\\Spells\\Human\\Avatar\\AvatarCaster.mdx", 16, 34, 0.0), mark("Abilities\\Spells\\Human\\Thunderclap\\ThunderClapCaster.mdx", 33, 14, 0.0)],
  regions: [heroRegion(33, 35, capsule(-180.0, 30.0, 180.0, 30.0, 50.0), hit(8.25, 75, 75.0, 40.0))],
  buff: { frame: 33, kind: ItemKind.heavy, frames: 600 },
};

const WARDEN: AuthoredSpecial = {
  name: "Vengeance", endFrame: 40, groundOnly: true,
  placement: {
    frame: 22, offsetX: -60.0, radius: 40.0, height: 140.0, durability: 30.0, life: 90, fireAges: [2, 17, 32, 47],
    shot: shot(0, 40.0, 50.0, 18.0, 0.0, 50, 26.0, hit(5.0, 40, 60.0, 30.0, HitElement.slash), "Abilities\\Weapons\\SpiritOfVengeanceMissile\\SpiritOfVengeanceMissile.mdx"),
    model: { path: "Units\\NightElf\\SpiritOfVengeance\\SpiritOfVengeance.mdx", height: 150.0, alpha: 255 },
  },
};

const LICH: AuthoredSpecial = {
  name: "Frost Wyrm", endFrame: 60,
  projectiles: [
    mark("Abilities\\Spells\\Undead\\FreezingBreath\\FreezingBreathTargetArt.mdx", 2, 29, -600.0, 95.0),
    { ...shot(31, -600.0, 95.0, 28.0, 0.0, 70, 45.0, hit(16.0, 60, 85.0, 45.0, HitElement.ice), "Abilities\\Weapons\\FrostWyrmMissile\\FrostWyrmMissile.mdx"), status: CHILL },
  ],
};

const FORSAKEN_PALADIN: AuthoredSpecial = {
  name: "Light's Hammer", endFrame: 70, groundOnly: true,
  projectiles: [
    mark("Abilities\\Spells\\Other\\Consecration\\Consecration.mdx", 2, 62, 220.0),
    mark("Abilities\\Spells\\Human\\Resurrect\\ResurrectTarget.mdx", 34, 14, 220.0),
  ],
  regions: [
    heroRegion(40, 42, capsule(220.0, 20.0, 220.0, 150.0, 100.0), hit(18.0, 75, 90.0, 45.0, HitElement.holy)),
    heroRegion(52, 52, capsule(110.0, 10.0, 330.0, 10.0, 25.0), hit(4.0, 80, 30.0, 30.0, HitElement.holy)),
    heroRegion(64, 64, capsule(110.0, 10.0, 330.0, 10.0, 25.0), hit(4.0, 80, 30.0, 30.0, HitElement.holy)),
  ],
  rehits: [52, 64],
};

const DREADLORD: AuthoredSpecial = {
  name: "Inferno", endFrame: 56, groundOnly: true,
  projectiles: [
    mark("Abilities\\Spells\\Human\\MarkOfChaos\\MarkOfChaosTarget.mdx", 4, 36, 260.0),
    { ...mark("Abilities\\Weapons\\DemolisherFireMissile\\DemolisherFireMissile.mdx", 28, 12, 260.0, 600.0), velocityZ: -48.0 },
    mark("Abilities\\Spells\\Other\\Incinerate\\FireLordDeathExplode.mdx", 40, 14, 260.0),
  ],
  regions: [heroRegion(40, 42, capsule(260.0, 20.0, 260.0, 120.0, 100.0), hit(14.0, 80, 90.0, 45.0, HitElement.fire))],
};

const VOODOO_AURA = "Abilities\\Spells\\Orc\\Voodoo\\VoodooAura.mdx";
const VOODOO_WARD_MARK = "Abilities\\Spells\\Orc\\Voodoo\\VoodooAuraTarget.mdx";
const VOODOO_BOLT = "Abilities\\Weapons\\SerpentWardMissile\\SerpentWardMissile.mdx";
const VOODOO_END = 105;
const VOODOO_WARD_FRAME = 16;
const voodooBolt = (effect: HitEffect): SpecialProjectile => shot(0, 30.0, 50.0, 14.0, 0.0, 24, 26.0, effect, VOODOO_BOLT);
const SHADOW_HUNTER: AuthoredSpecial = {
  name: "Big Bad Voodoo", endFrame: VOODOO_END, groundOnly: true,
  projectiles: [{ ...mark(VOODOO_AURA, 2, VOODOO_END - 2, 0.0), cancelOnInterrupt: true }],
  placement: {
    frame: VOODOO_WARD_FRAME, slot: 1, offsetX: 140.0, radius: 30.0, height: 130.0, durability: 1.0, life: VOODOO_END - VOODOO_WARD_FRAME + 1,
    fireAges: [7, 22, 37, 52], outwardPair: true, channeled: true,
    shot: voodooBolt(hit(4.0, 40, 20.0, 30.0, HitElement.poison)),
    finalShot: voodooBolt(hit(8.0, 45, 85.0, 45.0, HitElement.poison)),
    mark: { ...mark(VOODOO_WARD_MARK, 0, VOODOO_END - VOODOO_WARD_FRAME, 0.0), cancelOnInterrupt: true },
    model: { path: "Units\\Orc\\SerpentWard\\SerpentWard.mdx", height: 300.0, alpha: 255 },
  },
};

const DOOM: AppliedStatus = { kind: HeroStatusKind.poison, frames: 180, group: HeroStatusGroup.sleep, immunityFrames: 0, tick: { every: 15, damage: 1.0 } };
const PIT_LORD: AuthoredSpecial = {
  name: "Doom", endFrame: 60, groundOnly: true,
  projectiles: [mark("Abilities\\Spells\\Undead\\Curse\\CurseTarget.mdx", 1, 18, 60.0, 80.0)],
  commandGrab: { ...frames(19, 22), strike: capsule(30.0, 60.0, 130.0, 60.0, 40.0), holdFrames: 30, effect: hit(10.0, 45, 85.0, 45.0, HitElement.fire), recovery: 30, status: DOOM },
};

const BEASTMASTER: AuthoredSpecial = {
  name: "Stampede", endFrame: 70, groundOnly: true,
  projectiles: [
    mark("Abilities\\Spells\\Other\\Stampede\\StampedeMissileDeath.mdx", 2, 22, -100.0),
    shot(25, -150.0, 25.0, 22.0, 0.0, 60, 30.0, hit(9.0, 40, 80.0, 40.0), "units\\creeps\\QuillBeast\\QuillBeast.mdl"),
    shot(40, -150.0, 70.0, 22.0, 0.0, 60, 45.0, hit(9.0, 40, 80.0, 40.0), "units\\creeps\\GrizzlyBear\\GrizzlyBear.mdl"),
    shot(55, -150.0, 190.0, 22.0, 0.0, 60, 30.0, hit(9.0, 40, 80.0, 40.0), "units\\creeps\\WarEagle\\WarEagle.mdl"),
  ],
};

const RISEN = shot(0, 0.0, 40.0, 0.0, 0.0, 4, 90.0, hit(15.0, 85, 90.0, 45.0, HitElement.dark), "Abilities\\Spells\\Undead\\Impale\\ImpaleHitTarget.mdx");
const LICH_KING: AuthoredSpecial = {
  name: "Animate Dead", endFrame: 64, groundOnly: true,
  projectiles: [mark("Abilities\\Spells\\Undead\\AnimateDead\\AnimateDeadTarget.mdx", 2, 38, 0.0, 0.0, true, RISEN)],
};

const tremor = (direction: number): SpecialProjectile => ({
  ...shot(27, direction * 40.0, 25.0, direction * 16.0, 0.0, 50, 50.0, hit(15.0, 70, 85.0, 40.0), "Abilities\\Spells\\Orc\\Shockwave\\ShockwaveMissile.mdx"),
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
  name: "Glacial Ray", endFrame: 80, groundOnly: true,
  projectiles: [
    mark("Abilities\\Spells\\Undead\\FreezingBreath\\FreezingBreathTargetArt.mdx", 2, 22, 40.0, 90.0),
    ray(25, f32(28.284271), f32(28.284271), GLANCE),
    ray(33, f32(37.587704), f32(13.680806), GLANCE),
    ray(41, 40.0, 0.0, GLANCE),
    ray(49, f32(39.392310), f32(-6.945927), hit(10.0, 30, 90.0, 45.0, HitElement.ice)),
  ],
};

const POSSESSION = "Abilities\\Spells\\Undead\\Possession\\PossessionMissile.mdx";
const SHADOW_WAKE: SpecialProjectile = { ...mark(POSSESSION, 0, 44, 0.0, 50.0), radius: 48.0, activeFrom: 45, trail: { every: 0 } };
const SHADOW_TRAIL: SpecialProjectile = { ...shot(0, 0.0, 50.0, 0.0, 0.0, 120, 48.0, hit(1.0, 90, 0.0, 0.0, HitElement.dark), POSSESSION), activeFrom: 121, trail: { every: 20 } };
const wake = (spawnFrame: number): SpecialProjectile => ({ ...SHADOW_WAKE, spawnFrame });
const BANSHEE_SPEED = 9.0;
const BANSHEE_TURN = { turnCos: f32(0.9975640502598242), turnSin: f32(0.0697564737441253) };
const BANSHEE_CARRY: AuthoredSpecial = {
  endFrame: 29,
  motion: [{ ...frames(1, 9), velocityX: 0.0, velocityZ: 0.0, seek: { speed: BANSHEE_SPEED, turnCos: 1.0, turnSin: 0.0 } }, { ...frames(10, 10), velocityX: 0.0, velocityZ: 0.0 }],
  intangible: frames(1, 9),
  projectiles: [wake(1), wake(5), wake(9)],
  burst: { frame: 10, from: SHADOW_WAKE, into: SHADOW_TRAIL },
};
const SYLVANAS: AuthoredSpecial = {
  name: "Banshee Form", endFrame: 128,
  projectiles: [
    mark("Abilities\\Spells\\Undead\\Possession\\PossessionCaster.mdx", 2, 17, 0.0),
    ...Array.from({ length: 16 }, (_, index) => wake(19 + index * 5)),
  ],
  motion: [
    { ...frames(1, 18), velocityX: 0.0, velocityZ: 0.0 },
    { ...frames(19, 98), velocityX: 0.0, velocityZ: 0.0, seek: { speed: BANSHEE_SPEED, ...BANSHEE_TURN } },
    { ...frames(99, 99), velocityX: 0.0, velocityZ: 0.0 },
  ],
  intangible: frames(19, 98),
  regions: [heroRegion(19, 98, capsule(0.0, 45.0, 0.0, 75.0, 32.0), hit(14.0, 45, 72.0, 45.0, HitElement.dark))],
  followUps: [{ window: frames(19, 99), input: FollowUpInput.contact, special: BANSHEE_CARRY }],
  burst: { frame: 99, from: SHADOW_WAKE, into: SHADOW_TRAIL },
};

const CAIRNE_ANKH: SpecialProjectile = {
  ...mark("Abilities\\Spells\\Orc\\Reincarnation\\ReincarnationTarget.mdx", 1, 36, 0.0), atStageCentre: true, cancelOnInterrupt: true,
};
const CAIRNE: AuthoredSpecial = {
  name: "Reincarnation", endFrame: 50, groundOnly: true,
  projectiles: [
    CAIRNE_ANKH,
    { ...mark("Abilities\\Spells\\Human\\Resurrect\\ResurrectTarget.mdx", 25, 10, 0.0), atStageCentre: true, cancelOnInterrupt: true },
    { ...mark("Abilities\\Spells\\Orc\\WarStomp\\WarStompCaster.mdx", 25, 10, 0.0), atStageCentre: true, cancelOnInterrupt: true },
  ],
  regionOrigin: CAIRNE_ANKH,
  regions: [heroRegion(25, 25, capsule(0.0, 40.0, 0.0, 40.0, 90.0), hit(12.0, 70, 80.0, 40.0, HitElement.holy))],
  motion: [{ ...frames(26, 26), velocityX: 0.0, velocityZ: 0.0, relocateProjectile: CAIRNE_ANKH }],
  // The engine primes intangibility one frame ahead, so arrival protection starts at teleport frame 26.
  intangible: frames(27, 31),
};

const SPIRIT = "units\\creeps\\PandarenBrewmaster\\PandarenBrewmaster.mdl";
const CHEN: AuthoredSpecial = {
  name: "Storm, Earth and Fire", endFrame: 64, groundOnly: true,
  projectiles: [
    mark(SPIRIT, 2, 22, 40.0),
    mark(SPIRIT, 10, 26, 220.0),
    mark(SPIRIT, 18, 30, -150.0),
    mark("Abilities\\Spells\\Orc\\WarStomp\\WarStompCaster.mdx", 21, 12, 0.0),
    mark("Abilities\\Spells\\Other\\Monsoon\\MonsoonBoltTarget.mdx", 33, 12, 220.0),
    mark("Abilities\\Spells\\Other\\BreathOfFire\\BreathOfFireDamage.mdx", 45, 14, -150.0),
  ],
  regions: [
    heroRegion(21, 23, capsule(-120.0, 20.0, 120.0, 20.0, 50.0), hit(8.0, 80, 70.0, 40.0)),
    heroRegion(33, 35, capsule(200.0, 30.0, 240.0, 110.0, 45.0), hit(7.0, 45, 70.0, 40.0, HitElement.electric)),
    heroRegion(45, 48, capsule(-60.0, 50.0, -220.0, 50.0, 50.0), hit(9.0, 40, 85.0, 45.0, HitElement.fire, true)),
  ],
  rehits: [21, 33, 45],
};

const TREE = hit(20.0, 40, 90.0, 45.0);
const PEON: AuthoredSpecial = {
  name: "Timber!", endFrame: 70, groundOnly: true,
  projectiles: [
    mark("units\\nightelf\\Ent\\Ent.mdl", 2, 46, 80.0),
    mark("Abilities\\Spells\\NightElf\\TargetArtLumber\\TargetArtLumber.mdx", 12, 10, 60.0, 40.0),
    mark("Abilities\\Spells\\NightElf\\TargetArtLumber\\TargetArtLumber.mdx", 24, 10, 60.0, 40.0),
  ],
  regions: [
    heroRegion(37, 39, capsule(60.0, 0.0, f32(168.703), f32(405.689), 35.0), TREE),
    heroRegion(40, 42, capsule(60.0, 0.0, f32(329.970), f32(321.739), 35.0), TREE),
    heroRegion(43, 45, capsule(60.0, 0.0, f32(440.646), f32(177.500), 35.0), TREE),
    heroRegion(46, 48, capsule(60.0, 15.0, 480.0, 15.0, 35.0), TREE),
  ],
};

const OVERDRIVE_BLAST = shot(0, 0.0, 30.0, 0.0, 0.0, 4, 150.0, hit(18.0, 55, 90.0, 45.0, HitElement.fire), "Objects\\Spawnmodels\\Other\\NeutralBuildingExplosion\\NeutralBuildingExplosion.mdx");
const TINKER: AuthoredSpecial = {
  name: "Robo-Goblin Overdrive", endFrame: 50, groundOnly: true,
  projectiles: [{ ...shot(20, 60.0, 30.0, 6.0, 0.0, 60, 40.0, hit(3.0, 30, 20.0, 30.0), "Units\\Creeps\\HeroTinkerRobot\\HeroTinkerRobot.mdl"), expiresInto: OVERDRIVE_BLAST }],
};

const GRAVITY_RING = "Abilities\\Spells\\Human\\MassTeleport\\MassTeleportTarget.mdx";
const GRAVITY_LIFT = "Abilities\\Spells\\NightElf\\Cyclone\\CycloneTarget.mdx";
const KAELTHAS: AuthoredSpecial = {
  name: "Gravity Lapse", endFrame: 60, groundOnly: true,
  projectiles: [
    ...[-260.0, 0.0, 260.0].map((offsetX) => mark(GRAVITY_RING, 2, 27, offsetX)),
    ...[-180.0, 0.0, 180.0].map((offsetX) => mark(GRAVITY_LIFT, 29, 24, offsetX)),
  ],
  regions: [heroRegion(29, 31, capsule(-260.0, 40.0, 260.0, 40.0, 120.0), hit(14.0, 90, 85.0, 60.0, HitElement.arcane))],
};

const MURLOC_MODEL = "units\\creeps\\Murloc\\Murloc.mdl";
const swarm = (offsetX: number): SpecialProjectile => ({
  ...shot(20, offsetX, 20.0, 30.0, 0.0, 45, 40.0, hit(2.0, 25, 10.0, 30.0), MURLOC_MODEL),
  pool: { every: 6, growth: 0.0, maxRadius: 40.0 }, modelRadius: 70.0,
});
const MURLOC: AuthoredSpecial = {
  name: "Mrglglgl Stampede", endFrame: 70, groundOnly: true,
  projectiles: [
    mark("Abilities\\Spells\\Other\\CrushingWave\\CrushingWaveDamage.mdx", 2, 18, -520.0),
    swarm(-520.0), swarm(-560.0), swarm(-600.0),
    { ...shot(20, -660.0, 20.0, 30.0, 0.0, 45, 40.0, hit(10.0, 40, 90.0, 45.0), MURLOC_MODEL), modelRadius: 70.0 },
  ],
};

const part = (x1: number, z1: number, x2: number, z2: number, radius: number): HurtPart => ({ x1, z1, x2, z2, radius });
const pose = (firstFrame: number, lastFrame: number, parts: readonly HurtPart[]): HurtPose => ({ firstFrame, lastFrame, parts });

const GROM: AuthoredSpecial = {
  name: "Blood of Mannoroth", endFrame: 70, groundOnly: true,
  projectiles: [mark("Abilities\\Spells\\Orc\\Bloodlust\\BloodlustTarget.mdx", 1, 16, 0.0)],
  motion: [{ ...frames(17, 40), velocityX: 22.0, velocityZ: 0.0 }, { ...frames(41, 41), velocityX: 0.0, velocityZ: 0.0 }],
  commandGrab: { ...frames(17, 40), strike: capsule(20.0, 50.0, 70.0, 50.0, 40.0), holdFrames: 30, effect: hit(11.5, 40, 90.0, 45.0, HitElement.slash), recovery: 24 },
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
    { ...shot(17, 60.0, 60.0, 5.0, 0.0, 90, 90.0, hit(2.0, 80, 10.0, 25.0, HitElement.poison), LOCUST), pool: { every: 12, growth: 0.0, maxRadius: 90.0 } },
    ...[{ x: 5.0, z: 105.0 }, { x: 115.0, z: 85.0 }, { x: 95.0, z: 15.0 }].map(({ x, z }) => ({ ...mark(LOCUST, 17, 90, x, z), velocityX: 5.0 })),
  ],
};

const MALFURION: AuthoredSpecial = {
  name: "Wisps of Hyjal", endFrame: 50,
  projectiles: [
    mark("Abilities\\Spells\\NightElf\\Tranquility\\TranquilityTarget.mdx", 2, 26, 0.0),
    shot(29, 60.0, 70.0, 7.0, 0.0, 120, 70.0, hit(20.0, 50, 90.0, 45.0, HitElement.holy), "Units\\NightElf\\Wisp\\Wisp.mdx"),
  ],
};

const PULL = [25, 37, 49] as const;
const MEDIVH: AuthoredSpecial = {
  name: "The Dark Portal", endFrame: 70, groundOnly: true,
  projectiles: [mark("Abilities\\Spells\\Demon\\DarkPortal\\DarkPortalTarget.mdx", 2, 62, 240.0)],
  regions: [
    ...PULL.flatMap((first): MoveRegion[] => [
      heroRegion(first, first, capsule(40.0, 50.0, 200.0, 50.0, 80.0), hit(1.0, 25, 0.0, 30.0, HitElement.dark)),
      heroRegion(first, first, capsule(280.0, 50.0, 440.0, 50.0, 80.0), hit(1.0, 25, 0.0, 30.0, HitElement.dark, true)),
    ]),
    heroRegion(64, 66, capsule(240.0, 20.0, 240.0, 120.0, 110.0), hit(12.0, 60, 90.0, 45.0, HitElement.dark)),
  ],
  rehits: [...PULL, 64],
};

export const KOBOLD_BURROW_FIRST = 15;
export const KOBOLD_BURROW_LAST = 54;

const KOBOLD: AuthoredSpecial = {
  name: "You No Take Candle!", endFrame: 85, groundOnly: true,
  intangible: frames(8, 54),
  projectiles: [mark("Objects\\Spawnmodels\\Undead\\ImpaleTargetDust\\ImpaleTargetDust.mdx", 8, 12, 0.0)],
  motion: [{ ...frames(KOBOLD_BURROW_FIRST, KOBOLD_BURROW_LAST), velocityX: 10.0, velocityZ: 0.0, driftSpeed: 6.0, stopsAtBody: true }, { ...frames(55, 58), velocityX: 0.0, velocityZ: 12.0 }],
  regions: [heroRegion(55, 58, capsule(20.0, 0.0, 20.0, 120.0, 50.0), hit(16.0, 85, 85.0, 45.0))],
};

/** Every fighter's ultimate, by character. */
export const FIGHTER_ULTIMATES: { readonly [character: number]: AuthoredSpecial | undefined } = {
  [Character.rifleman]: RIFLEMAN,
  [Character.demonHunter]: ILLIDAN,
  [Character.blademaster]: BLADEMASTER,
  [Character.mountainKing]: MOUNTAIN_KING,
  [Character.warden]: WARDEN,
  [Character.lich]: LICH,
  [Character.forsakenPaladin]: FORSAKEN_PALADIN,
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
  [Character.kobold]: KOBOLD,
};


const ULTIMATE_DESCRIPTIONS: { readonly [character: number]: string | undefined } = {
  [Character.rifleman]: "Kneel and aim: a red line shows the shot, then one bullet crosses the stage. Jump or shield it.",
  [Character.demonHunter]: "Fel fire burns around him as he becomes a demon: a burst launches nearby foes, then he moves faster for 8 seconds.",
  [Character.blademaster]: "A steerable whirlwind of cuts ending in a strong slash, then he is dizzy. Shield, jump above it or outrun it.",
  [Character.mountainKing]: "He turns to stone with a stomp: heavier for 10 seconds. Hit him while he changes.",
  [Character.warden]: "The Avatar of Vengeance rises behind her and throws four ghostly glaives. Break it or dodge the glaives.",
  [Character.lich]: "A frost wyrm sweeps straight ahead at body height. Jump or shield it.",
  [Character.forsakenPaladin]: "A golden circle marks where the Light's hammer will fall, then blesses the ground twice. Leave the circle.",
  [Character.dreadlord]: "An Infernal crashes onto a burning mark ahead. Leave the mark.",
  [Character.shadowHunter]: "He dances while two serpent wards beside him spit bolts outward, then a launcher. The wards can't be hurt; hit him to end the dance and sink them.",
  [Character.pitLord]: "A clawed grab that ignores shields brands the victim with Doom, burning on after the throw. Jump or roll away.",
  [Character.beastmaster]: "His pack stampedes past: a low quilbeast, a bear, then a high hawk. Jump, shield, then stay low.",
  [Character.lichKing]: "Runes mark the ground under the nearest foe; the dead claw up there a moment later. Step off the mark.",
  [Character.thrall]: "Tremors run along the ground both ways. Jump them or stand on a platform.",
  [Character.jaina]: "A ray of frost sweeps down from high ahead of her to the floor. Get behind her or shield.",
  [Character.sylvanas]: "She becomes a banshee and dives through the nearest foe, leaving a shadow trail that stings anyone standing in it. Hit her while she changes; roll through the dive or shield it.",
  [Character.cairne]: "An ankh appears at centre stage. After 24 frames it bursts, then he teleports there with 6 frames of intangibility. Shield or leave the ankh; punish his arrival recovery.",
  [Character.chen]: "He splits into Earth, Storm and Fire, which strike around him one after another.",
  [Character.peon]: "He chops at a big tree until it falls forward across the stage. Stand behind him or hit him while he chops.",
  [Character.tinker]: "His Robo-Goblin waddles ahead and explodes. Walk away or shield the blast.",
  [Character.kaelthas]: "Arcane orbs ring him, then everyone inside is lifted straight up. Leave the ring.",
  [Character.murloc]: "He blows a conch and a swarm of murlocs pours across the ground. Jump over it or shield.",
  [Character.grom]: "Demon blood drives a charge that catches the first foe, through a shield, for three Gorehowl chops. Jump it.",
  [Character.anubarak]: "A slow cloud of beetles drifts ahead, stinging anyone standing in it. Jump or shield.",
  [Character.malfurion]: "A slow wall of wisps drifts forward and detonates on whoever it reaches.",
  [Character.medivh]: "A dark portal opens ahead, drawing foes in, then erupts. Walk away before it bursts.",
  [Character.kobold]: "He digs in and burrows toward the foe, then bursts up under them. Watch the dirt.",
};

/** The ultimate's official name and one-line description, for the move list and Moves page. */
export function ultimateText(character: number): NamedMove | undefined {
  const move = FIGHTER_ULTIMATES[character];
  const description = ULTIMATE_DESCRIPTIONS[character];
  return move?.name === undefined || description === undefined ? undefined : { name: move.name, description };
}


/** Where a computer fighter presses its ultimate: the target's distance ahead, near to far; far 0 never (a counter or a high sweep it cannot aim). */
export const ULTIMATE_REACH: { readonly [character: number]: { readonly near: number; readonly far: number } | undefined } = {
  [Character.rifleman]: { near: 150.0, far: 900.0 },
  [Character.demonHunter]: { near: 0.0, far: 150.0 },
  [Character.blademaster]: { near: 0.0, far: 120.0 },
  [Character.mountainKing]: { near: 0.0, far: 170.0 },
  [Character.warden]: { near: 120.0, far: 500.0 },
  [Character.lich]: { near: 0.0, far: 600.0 },
  [Character.forsakenPaladin]: { near: 150.0, far: 300.0 },
  [Character.dreadlord]: { near: 190.0, far: 330.0 },
  [Character.shadowHunter]: { near: 180.0, far: 480.0 },
  [Character.pitLord]: { near: 40.0, far: 120.0 },
  [Character.beastmaster]: { near: 100.0, far: 700.0 },
  [Character.lichKing]: { near: 150.0, far: 600.0 },
  [Character.thrall]: { near: 60.0, far: 600.0 },
  [Character.jaina]: { near: 120.0, far: 500.0 },
  [Character.sylvanas]: { near: 150.0, far: 600.0 },
  [Character.cairne]: { near: 0.0, far: 0.0 },
  [Character.chen]: { near: 0.0, far: 240.0 },
  [Character.peon]: { near: 80.0, far: 420.0 },
  [Character.tinker]: { near: 80.0, far: 300.0 },
  [Character.kaelthas]: { near: 0.0, far: 240.0 },
  [Character.murloc]: { near: 100.0, far: 600.0 },
  [Character.grom]: { near: 60.0, far: 400.0 },
  [Character.anubarak]: { near: 60.0, far: 300.0 },
  [Character.malfurion]: { near: 100.0, far: 500.0 },
  [Character.medivh]: { near: 150.0, far: 330.0 },
  [Character.kobold]: { near: 80.0, far: 350.0 },
};
