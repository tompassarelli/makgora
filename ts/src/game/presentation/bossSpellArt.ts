import { f32 } from "wisp/src/sim/f32";

export const BossSpell = { rainOfFire: 0, fingerOfDeath: 1, doomsShockwave: 2 } as const;
export type BossSpell = (typeof BossSpell)[keyof typeof BossSpell];

const SPELLS: { readonly [name: string]: BossSpell } = { "Rain of Fire": BossSpell.rainOfFire, "Finger of Death": BossSpell.fingerOfDeath, "Doom's Shockwave": BossSpell.doomsShockwave };

export const bossSpell = (name: string): BossSpell | undefined => SPELLS[name];

export const RAIN_OF_FIRE_MODEL = "Abilities\\Spells\\Demon\\RainOfFire\\RainOfFireTarget.mdx";
export const RAIN_OF_FIRE_LANDS = 46;
export const RAIN_OF_FIRE_FRAMES = 84;
export const RAIN_OF_FIRE_SCALE = f32(0.75);
export const COLUMN_FIRE_MODEL = "Doodads\\Cinematic\\TownBurningFireEmitter\\TownBurningFireEmitter.mdx";
export const COLUMN_FIRE_SCALE = { from: f32(0.3), to: f32(0.9) } as const;
export const FIRE_BURST_MODEL = "Doodads\\Cinematic\\FirePillarMedium\\FirePillarMedium.mdx";
export const FIRE_BURST_SCALE = f32(1.8);
export const FIRE_BURST_FRAMES = 40;

export const FINGER_LIGHTNING = "AFOD";
export const FINGER_CHARGE_MODEL = "Abilities\\Weapons\\GreenDragonMissile\\GreenDragonMissile.mdx";
export const FINGER_CHARGE_SCALE = { from: f32(0.6), to: f32(2.4) } as const;
export const FINGER_CHARGE_Z = 70.0;
export const FINGER_IMPACT_MODEL = "Abilities\\Spells\\Demon\\DemonBoltImpact\\DemonBoltImpact.mdx";
export const FINGER_IMPACT_FRAMES = 48;
export const FINGER_IMPACT_SCALE = f32(1.8);
export const FINGER_AIM_ALPHA = { from: f32(0.15), to: f32(0.8) } as const;
export const FINGER_LINGER_FRAMES = 10;
export const BOSS_HAND_Z = 260.0;

export const SHOCKWAVE_TRAIL_MODEL = "Abilities\\Spells\\Other\\BreathOfFire\\BreathOfFireDamage.mdx";
export const SHOCKWAVE_TRAIL_SCALE = { from: f32(0.8), to: f32(1.8) } as const;
export const SHOCKWAVE_POINTS = 11;
export const SHOCKWAVE_SPACING = 120.0;
export const SHOCKWAVE_SWEEP = f32(0.6);
export const SHOCKWAVE_MODEL = "Doodads\\Cinematic\\FireTrapUp\\FireTrapUp.mdx";
export const SHOCKWAVE_PILLAR_SCALE = f32(1.2);
export const SHOCKWAVE_FRAMES = 60;

export const IMPACT_RESPAWN_FRAMES = 4;
export const IMPACT_RESPAWNS = 3;

export const BODY_CAST: { readonly [spell: number]: { readonly tell: string; readonly active: string | undefined } } = {
  [BossSpell.rainOfFire]: { tell: "spell", active: "attack" },
  [BossSpell.fingerOfDeath]: { tell: "spell", active: "attack" },
  [BossSpell.doomsShockwave]: { tell: "spell slam", active: undefined },
};

export const shockwavePointX = (index: number): number => f32((index - (SHOCKWAVE_POINTS - 1) / 2) * SHOCKWAVE_SPACING);

export function shockwaveIgnition(index: number, bossX: number, tell: number): number {
  const reach = Math.max(Math.abs(shockwavePointX(0) - bossX), Math.abs(shockwavePointX(SHOCKWAVE_POINTS - 1) - bossX));
  if (reach <= 0) return 0;
  const share = f32(Math.abs(shockwavePointX(index) - bossX) / reach);
  return Math.floor(tell * SHOCKWAVE_SWEEP * share);
}

export const growth = (from: number, to: number, frame: number, frames: number): number =>
  frames <= 0 ? to : f32(from + f32(f32(to - from) * Math.max(0.0, Math.min(1.0, frame / frames))));
