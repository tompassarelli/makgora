



import { f32 } from "wisp/src/sim/f32";
import { Character } from "../codes";

export interface HeroBody {
  readonly weight: number;
  readonly run: number;

  readonly walkSpeed?: number | undefined;
  readonly runSpeed?: number | undefined;
  readonly dashSpeed?: number | undefined;
  readonly dashRunFrame?: number | undefined;
  readonly traction?: number | undefined;
  readonly air: number;
  readonly width: number;
  readonly height: number;

}

const body = (weight: number, run: number, air: number, width: number, height: number): HeroBody => ({ weight, run, air, width, height });

const HERO_BODIES: { readonly [character: number]: HeroBody | undefined } = {
  [Character.anubarak]: { ...body(f32(1.28), f32(0.82), 0.75, f32(1.6), f32(1.35)), dashRunFrame: 16, traction: f32(0.08) },
  [Character.blademaster]: { ...body(f32(0.96), f32(1.08), f32(1.00), f32(1.00), f32(1.05)), runSpeed: f32(13.74), dashSpeed: f32(11.892), traction: f32(0.06) },
  [Character.mountainKing]: { ...body(f32(1.12), f32(0.88), f32(0.82), f32(1.10), f32(0.85)), traction: f32(0.065) },
  [Character.warden]: { ...body(f32(78.0 / 75.0), f32(1.14), f32(0.95), f32(0.90), f32(1.00)), runSpeed: 13.799999237060547, dashSpeed: 12.0, traction: f32(0.08) },
  [Character.lich]: { ...body(f32(1.04), f32(0.90), f32(0.95), f32(0.90), f32(1.28)), traction: f32(0.06) },
  [Character.forsakenPaladin]: { ...body(f32(1.22), f32(0.92), f32(0.88), f32(1.08), f32(1.02)), traction: f32(0.065) },
  [Character.dreadlord]: { ...body(f32(1.27), f32(1.10), f32(1.22), f32(1.10), f32(1.15)), runSpeed: f32(13.76), dashSpeed: f32(11.928), traction: f32(0.06) },
  [Character.shadowHunter]: { ...body(f32(0.94), f32(1.04), f32(1.00), f32(0.92), f32(1.08)), traction: f32(0.06) },

  [Character.pitLord]: { ...body(f32(1.28), f32(0.80), f32(0.75), f32(1.65), f32(1.35)), dashRunFrame: 16, traction: f32(0.08) },
  [Character.beastmaster]: { ...body(f32(1.10), f32(0.97), f32(0.88), f32(1.15), f32(1.26)), traction: f32(0.065) },
  [Character.chen]: { ...body(f32(1.3733333333333333), f32(0.7272727272727273), f32(1.12), f32(1.18), f32(1.04)), traction: f32(0.065) },
  [Character.kaelthas]: { ...body(f32(0.88), f32(0.78), f32(1.28), f32(0.96), f32(1.12)), traction: f32(0.055) },
  [Character.lichKing]: { ...body(f32(1.12), f32(0.84), f32(0.86), f32(1.12), f32(1.26)), traction: f32(0.065) },
  [Character.thrall]: { ...body(f32(1.6933333333333334), f32(0.68), f32(0.75), 1.25, f32(1.15)), dashRunFrame: 16, traction: f32(0.07) },
  [Character.malfurion]: { ...body(f32(94.0 / 75.0), f32(f32(10.8) / f32(13.2)), f32(0.95), 1.0, f32(1.1)), traction: f32(0.05) },
  [Character.jaina]: { ...body(f32(1.2), 0.5, f32(0.95), f32(0.9), f32(1.05)), traction: f32(0.03) },
  [Character.sylvanas]: { ...body(f32(96.0 / 75.0), f32(f32(1.828) / f32(2.2)), f32(0.935), f32(0.90), 1.0), traction: f32(0.05) },
  [Character.cairne]: { ...body(f32(143.0 / 75.0), f32(f32(1.485) / f32(2.2)), f32(0.945), f32(1.75), f32(1.45)), dashRunFrame: 16, traction: f32(0.08) },
  [Character.peon]: { ...body(f32(92.0 / 75.0), f32(f32(1.6) / f32(2.2)), f32(0.987), f32(0.88), f32(0.80)), traction: f32(0.05) },
  [Character.medivh]: { ...body(f32(0.90), f32(0.98), f32(1.20), f32(0.90), f32(1.10)), traction: f32(0.05) },
  [Character.murloc]: { ...body(f32(0.94), f32(1.12), f32(1.06), f32(0.90), f32(0.72)), runSpeed: 13.79999828338623, dashSpeed: 11.999999046325684, traction: f32(0.055) },
  [Character.kobold]: { ...body(f32(1.00), f32(1.10), f32(0.918), f32(0.78), f32(0.66)), walkSpeed: f32(8.64), runSpeed: f32(12.402), dashSpeed: f32(10.755), traction: f32(0.06) },
  [Character.grom]: { ...body(f32(0.98), f32(1.04), f32(0.92), f32(1.12), f32(1.10)), traction: f32(0.06) },
  [Character.tinker]: { ...body(f32(92.0 / 75.0), f32(f32(1.725) / f32(2.2)), f32(1.134), f32(1.12), f32(0.95)), traction: f32(0.065) },
};


export interface FighterShield {
  readonly centerZ: number;
  readonly radius: number;
}

const FIGHTER_SHIELDS: { readonly [character: number]: FighterShield | undefined } = {
  [Character.rifleman]: { centerZ: 43.5, radius: 88.0 },
  [Character.demonHunter]: { centerZ: 79.375, radius: 145.0 },
  [Character.blademaster]: { centerZ: f32(59.3), radius: 112.0 },
  [Character.mountainKing]: { centerZ: f32(44.9), radius: 91.0 },
  [Character.warden]: { centerZ: f32(57.2), radius: 107.0 },
  [Character.lich]: { centerZ: f32(75.67999), radius: 137.0 },
  [Character.forsakenPaladin]: { centerZ: f32(56.36), radius: 108.0 },
  [Character.dreadlord]: { centerZ: 75.5, radius: 144.0 },
  [Character.shadowHunter]: { centerZ: f32(62.240005), radius: 115.0 },
  [Character.pitLord]: { centerZ: f32(71.3), radius: 142.0 },
  [Character.beastmaster]: { centerZ: f32(71.36), radius: 133.0 },
  [Character.lichKing]: { centerZ: f32(71.71999), radius: 134.0 },
  [Character.thrall]: { centerZ: f32(62.9), radius: 180.0 },
  [Character.jaina]: { centerZ: f32(60.499996), radius: 112.0 },
  [Character.sylvanas]: { centerZ: f32(57.2), radius: 107.0 },
  [Character.cairne]: { centerZ: f32(76.700005), radius: 152.0 },
  [Character.chen]: { centerZ: f32(56.48), radius: 110.0 },
  [Character.peon]: { centerZ: f32(42.16), radius: 82.0 },
  [Character.tinker]: { centerZ: f32(51.260002), radius: 101.0 },
  [Character.kaelthas]: { centerZ: f32(64.399994), radius: 119.0 },
  [Character.murloc]: { centerZ: f32(38.72), radius: 77.0 },
  [Character.grom]: { centerZ: 74.5, radius: 136.0 },
  [Character.anubarak]: { centerZ: 61.5, radius: 148.0 },
  [Character.malfurion]: { centerZ: f32(62.6), radius: 117.0 },
  [Character.medivh]: { centerZ: f32(63.8), radius: 117.0 },
  [Character.kobold]: { centerZ: f32(36.2), radius: 71.0 },
};

export function fighterShield(character: number): FighterShield | undefined {
  return FIGHTER_SHIELDS[character];
}

export function heroBody(character: number): HeroBody | undefined {
  return HERO_BODIES[character];
}


export const isHero = (character: number): boolean => character >= Character.blademaster;
