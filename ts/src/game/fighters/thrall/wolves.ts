import { f32 } from "wisp/src/sim/f32";
import type { AuthoredSpecial, MotionVariant, ProjectileRun, SpecialKit, SpecialProjectile } from "../../sim/specials/schema";
import type { StickMotion } from "../../sim/stickMotion";
import { thrallHit } from "./moves";

export const WOLF_MOTION_WINDOW = 10;
export const QUARTER_CIRCLE_FORWARD: StickMotion = { window: WOLF_MOTION_WINDOW, steps: [{ x: 0, z: -1 }, { x: 1, z: -1 }, { x: 1, z: 0 }] };
export const DOWN_FORWARD: StickMotion = { window: 1, steps: [{ x: 1, z: -1 }] };

export const WolfForm = { spirit: 0, timber: 1, dire: 2 } as const;
export type WolfForm = (typeof WolfForm)[keyof typeof WolfForm];

export const GHOST_WOLF_MODEL = "units\\orc\\SpiritWolf\\SpiritWolf.mdx";
export const SPIRIT_WOLF_MODEL = "units\\creeps\\WhiteWolf\\WhiteWolf.mdx";
export const TIMBER_WOLF_MODEL = "units\\creeps\\TimberWolf\\TimberWolf.mdx";
export const DIRE_WOLF_MODEL = "units\\creeps\\DireWolf\\DireWolf.mdx";

export const WOLF_RUN: ProjectileRun = { gravity: 1.0, maxFall: 14.0 };
export const WOLF_POUNCE = 4.0;
export const WOLF_AIR_LANDING_LAG = 20;

export const SPIRIT_SPEED = 7.25;
export const SPIRIT_LIFE = 150;
export const SPIRIT_RADIUS = 30.0;
export const SPIRIT_SPAWN = 18;
export const SPIRIT_BITE_EVERY = 14;
export const SPIRIT_BITES = 3;

export const TIMBER_SPEED = 9.5;
export const TIMBER_LIFE = 60;
export const TIMBER_RADIUS = 12.0;
export const TIMBER_SPAWNS = [16, 28] as const;

export const DIRE_SPEED = 14.0;
export const DIRE_LIFE = 34;
export const DIRE_RADIUS = 16.0;
export const DIRE_SPAWN = 12;

const BITE_HOLD = 12;

const runner = (model: string, spawnFrame: number, speed: number, life: number, radius: number, air: boolean): Pick<SpecialProjectile, "model" | "spawnFrame" | "offsetX" | "offsetZ" | "velocityX" | "velocityZ" | "life" | "radius" | "reflectable" | "modelOffsetZ" | "runs"> => ({
  model, spawnFrame, offsetX: f32(30.0 + radius), offsetZ: radius, velocityX: speed, velocityZ: air ? WOLF_POUNCE : 0.0,
  life, radius, reflectable: false, modelOffsetZ: f32(-radius), runs: WOLF_RUN,
});

const spirit = (air: boolean): SpecialProjectile => ({
  ...runner(SPIRIT_WOLF_MODEL, SPIRIT_SPAWN, SPIRIT_SPEED, SPIRIT_LIFE, SPIRIT_RADIUS, air),
  effect: { ...thrallHit(5.0, 50, 40.0, 34.0), shieldDamage: 9.0 }, limit: 1,
  bites: { every: SPIRIT_BITE_EVERY, count: SPIRIT_BITES },
});

const timber = (spawnFrame: number, air: boolean): SpecialProjectile => ({
  ...runner(TIMBER_WOLF_MODEL, spawnFrame, TIMBER_SPEED, TIMBER_LIFE, TIMBER_RADIUS, air),
  effect: thrallHit(5.0, 55, 60.0, 30.0), limit: 2, bites: { every: BITE_HOLD, count: 1 },
});

const dire = (air: boolean): SpecialProjectile => ({
  ...runner(DIRE_WOLF_MODEL, DIRE_SPAWN, DIRE_SPEED, DIRE_LIFE, DIRE_RADIUS, air),
  effect: thrallHit(9.0, 25, 62.0, 40.0), limit: 1, bites: { every: BITE_HOLD, count: 1 },
});

const SPIRITS = [spirit(false), spirit(true)] as const;
const TIMBER_PACK = [[timber(TIMBER_SPAWNS[0], false), timber(TIMBER_SPAWNS[1], false)], [timber(TIMBER_SPAWNS[0], true), timber(TIMBER_SPAWNS[1], true)]] as const;
const DIRE_PACK = [dire(false), dire(true)] as const;

export const SPIRIT_WOLF = (air: boolean): SpecialProjectile => SPIRITS[air ? 1 : 0];
export const TIMBER_WOLVES = (air: boolean): readonly SpecialProjectile[] => TIMBER_PACK[air ? 1 : 0];
export const DIRE_WOLF = (air: boolean): SpecialProjectile => DIRE_PACK[air ? 1 : 0];

const BY_MOTION: readonly MotionVariant[] = [{ motion: QUARTER_CIRCLE_FORWARD, variant: WolfForm.dire }, { motion: DOWN_FORWARD, variant: WolfForm.timber }];

const landing = (air: boolean): number | undefined => (air ? WOLF_AIR_LANDING_LAG : undefined);

const wolves = (air: boolean): AuthoredSpecial => ({
  name: "Spirit Wolf", endFrame: 44, cooldownFrames: 150, landingLag: landing(air), projectiles: [SPIRIT_WOLF(air)],
  variantByMotion: BY_MOTION,
  variants: [
    { name: "Timber Wolves", endFrame: 46, cooldownFrames: 90, landingLag: landing(air), projectiles: TIMBER_WOLVES(air) },
    { name: "Dire Wolf", endFrame: 36, cooldownFrames: 75, landingLag: landing(air), projectiles: [DIRE_WOLF(air)] },
  ],
});

export const FERAL_SPIRIT: SpecialKit = {
  name: "Feral Spirit", selectedByMotion: QUARTER_CIRCLE_FORWARD,
  description: "Call a wolf that runs at the foe along the floor. Down calls a big, slow ghostly spirit wolf that bites a shield three times, so walk in behind it; down and forward sends two timber wolves one behind the other, so only a full jump clears both; a quarter-circle forward sends one fast dire wolf that knocks a foe down. Cast in the air, the wolves pounce ahead and run on where they land.",
  ground: wolves(false), air: wolves(true),
};
