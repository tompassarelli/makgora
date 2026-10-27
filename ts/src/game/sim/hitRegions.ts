import { downSmashHit } from "./downMoveValues";




import { f32 } from "wisp/src/sim/f32";
import { AttackStyle, Character, HitElement } from "./codes";
import type { FighterMoves, StrikeCapsule } from "./heroMoves";
import { strongHit, weakHit } from "./strongHits";
import { DIAGONAL_UNIT, ORDINARY_HIT_BASE_KNOCKBACK, ORDINARY_HIT_GROWTH_PERCENT } from "./knockback";
import {
  DOWN_ATTACK_BASE_KNOCKBACK,
  DOWN_ATTACK_DAMAGE,
  attackDamage,
  attackReach,
  attackStartupFrames,
  characterAttackActiveFrames,
  isSmashAttack,
  smashDamageMultiplier,
} from "./moves";

export { HitElement };



export interface HitEffect {
  damage: number;
  growth: number;
  base: number;
  launchX: number;
  launchZ: number;
  electric: boolean;

  element?: HitElement | undefined;




  manaDrain?: number | undefined;

  manaSteal?: number | undefined;

  carry?: boolean | undefined;

  strong?: boolean | undefined;

  setKnockback?: number | undefined;

  fixedPower?: number | undefined;

  stunFrames?: number | undefined;

  shieldDamage?: number | undefined;

  sakurai?: boolean | undefined;
}

export interface HitRegion {
  strike?: StrikeCapsule | undefined;
  groundedEffect?: Readonly<HitEffect> | undefined;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  readonly effect: HitEffect;
  window: number;
}

export function emptyHitEffect(): HitEffect {
  return { damage: 0.0, growth: 0.0, base: 0.0, launchX: 0.0, launchZ: 0.0, electric: false };
}

export function emptyHitRegion(): HitRegion {
  return { minX: 0.0, maxX: 0.0, minZ: 0.0, maxZ: 0.0, effect: emptyHitEffect(), window: 0 };
}

export function copyHitEffect(target: HitEffect, source: Readonly<HitEffect>): void {
  target.damage = source.damage;
  target.growth = source.growth;
  target.base = source.base;
  target.launchX = source.launchX;
  target.launchZ = source.launchZ;
  target.electric = source.electric;
  target.element = source.element;
  target.manaDrain = source.manaDrain;
  target.manaSteal = source.manaSteal;
  target.carry = source.carry;
  target.strong = source.strong;
  target.setKnockback = source.setKnockback;
  target.fixedPower = source.fixedPower;
  target.stunFrames = source.stunFrames;
  target.shieldDamage = source.shieldDamage;
  target.sakurai = source.sakurai;
}

export function copyHitRegion(target: HitRegion, source: Readonly<HitRegion>): void {
  target.strike = source.strike;
  target.groundedEffect = source.groundedEffect;
  target.minX = source.minX;
  target.maxX = source.maxX;
  target.minZ = source.minZ;
  target.maxZ = source.maxZ;
  copyHitEffect(target.effect, source.effect);
  target.window = source.window;
}

export const NO_HIT_REGION: Readonly<HitRegion> = emptyHitRegion();



function region(
  minX: number, maxX: number, minZ: number, maxZ: number,
  damage: number, growth: number, base: number, launchX: number, launchZ: number, window = 1,
): Readonly<HitRegion> {
  return { minX, maxX, minZ, maxZ, effect: { damage, growth, base, launchX, launchZ, electric: false }, window };
}





const DEMON_HUNTER_REGIONS: { readonly [style: number]: Readonly<HitRegion> } = {
  [AttackStyle.jab]: { ...region(27.0, 106.0, 76.0, 152.0, 5.0, 100.0, 18.0, DIAGONAL_UNIT, DIAGONAL_UNIT), strike: { x1: 41.0, z1: 90.0, x2: 92.0, z2: 138.0, radius: 14.0 } },
  [AttackStyle.jab2]: { ...region(27.0, 106.0, 76.0, 152.0, 4.0, 30.0, 22.0, 0.3420201539993286, 0.9396926164627075), strike: { x1: 41.0, z1: 90.0, x2: 92.0, z2: 138.0, radius: 14.0 } },
  [AttackStyle.upSmash]: { ...region(-21.0, 31.0, 74.0, 196.0, 15.0, 94.0, 20.0, DIAGONAL_UNIT, DIAGONAL_UNIT), strike: { x1: 5.0, z1: 100.0, x2: 5.0, z2: 170.0, radius: 26.0 } },

  [AttackStyle.demonHunterDashAttack]: { ...region(37.0, 78.0, 37.0, 158.0, 9.0, 95.0, 20.0, 0.5, 0.8660253882408142), strike: { x1: 55.0, z1: 55.0, x2: 60.0, z2: 140.0, radius: 18.0 } },

  [AttackStyle.forwardTilt]: { ...region(61.0, 154.0, 67.0, 104.0, 8.0, 80.0, 20.0, 0.9063078165054321, 0.4226182699203491), strike: { x1: 75.0, z1: 81.0, x2: 140.0, z2: 90.0, radius: 14.0 } },
  [AttackStyle.upTilt]: { ...region(-22.0, 62.0, 14.0, 191.0, 8.0, 20.0, 83.0, 0.1736481785774231, 0.9848077297210693), strike: { x1: 30.0, z1: 40.0, x2: 10.0, z2: 165.0, radius: 26.0 } },
  [AttackStyle.downTilt]: { ...region(-97.0, 132.0, -2.0, 52.0, 7.0, 20.0, 83.0, 0.1736481785774231, 0.9848077297210693), strike: { x1: -75.0, z1: 30.0, x2: 110.0, z2: 20.0, radius: 22.0 } },
  [AttackStyle.forwardTiltUp]: { ...region(39.0, 82.0, 133.0, 228.0, 8.0, 80.0, 20.0, 0.8799999952316284, 0.47999998927116394), strike: { x1: 53.0, z1: 147.0, x2: 68.0, z2: 214.0, radius: 14.0 } },
  [AttackStyle.forwardTiltDown]: { ...region(19.0, 134.0, -11.0, 78.0, 8.0, 80.0, 20.0, 0.8799999952316284, -0.47999998927116394), strike: { x1: 35.0, z1: 62.0, x2: 118.0, z2: 5.0, radius: 16.0 } },
  [AttackStyle.neutralAir]: { ...region(-41.0, 10.0, 57.0, 139.0, 7.0, 95.0, 16.0, DIAGONAL_UNIT, DIAGONAL_UNIT), strike: { x1: -4.0, z1: 125.0, x2: -27.0, z2: 71.0, radius: 14.0 } },
  [AttackStyle.forwardAir]: { ...region(4.0, 76.0, 86.0, 171.0, 6.0, 85.0, 18.0, 0.9399999976158142, 0.3400000035762787), strike: { x1: 62.0, z1: 100.0, x2: 18.0, z2: 157.0, radius: 14.0 } },
  [AttackStyle.backAir]: { ...region(-52.0, 35.0, 88.0, 147.0, 13.0, 100.0, 10.0, -0.9399999976158142, 0.3400000035762787), strike: { x1: 21.0, z1: 133.0, x2: -38.0, z2: 102.0, radius: 14.0 } },
  [AttackStyle.upAir]: { ...region(-55.0, 55.0, 15.0, 215.0, 8.0, 70.0, 50.0, 0.2199999988079071, 0.9750000238418579), strike: { x1: 0.0, z1: 70.0, x2: 0.0, z2: 160.0, radius: 55.0 } },
  [AttackStyle.downAir]: { ...region(-8.0, 63.0, 2.0, 90.0, 9.0, 100.0, 20.0, 0.1599999964237213, -0.9869999885559082), strike: { x1: 10.0, z1: 72.0, x2: 45.0, z2: 20.0, radius: 18.0 } },
};




export const DEMON_HUNTER_NEUTRAL_AIR_CLEAN_FRAMES = 4;
const FORWARD_AIR_LINK = { ...region(4.0, 76.0, 86.0, 171.0, 2.0, 10.0, 30.0, -0.258819043636322, 0.9659258127212524), strike: { x1: 62.0, z1: 100.0, x2: 18.0, z2: 157.0, radius: 14.0 } };
const FORWARD_AIR_LAUNCH = { ...region(6.0, 70.0, 86.0, 175.0, 3.0, 85.0, 18.0, 0.7660444378852844, 0.6427876353263855, 2), strike: { x1: 56.0, z1: 100.0, x2: 20.0, z2: 161.0, radius: 14.0 } };
const NEUTRAL_AIR_CLEAN = { ...DEMON_HUNTER_REGIONS[AttackStyle.neutralAir] ?? NO_HIT_REGION, effect: strongHit((DEMON_HUNTER_REGIONS[AttackStyle.neutralAir] ?? NO_HIT_REGION).effect) };
const NEUTRAL_AIR_LATE = { ...NEUTRAL_AIR_CLEAN, effect: weakHit(NEUTRAL_AIR_CLEAN.effect) };
const JAB3_EFFECT = region(0.0, 0.0, 0.0, 0.0, 6.0, 95.0, 22.0, 0.7660444378852844, 0.6427876353263855);
const JAB3_RISE = { ...JAB3_EFFECT, minX: -34.0, maxX: 58.0, minZ: 70.0, maxZ: 108.0, strike: { x1: -20.0, z1: 84.0, x2: 44.0, z2: 94.0, radius: 14.0 } };
const JAB3_CREST = { ...JAB3_EFFECT, minX: -32.0, maxX: 54.0, minZ: 54.0, maxZ: 108.0, strike: { x1: -18.0, z1: 68.0, x2: 40.0, z2: 94.0, radius: 14.0 } };
const JAB3_OVERHEAD = { ...JAB3_EFFECT, minX: 0.0, maxX: 68.0, minZ: 55.0, maxZ: 142.0, strike: { x1: 14.0, z1: 69.0, x2: 54.0, z2: 128.0, radius: 14.0 } };



function demonHunterRegion(style: AttackStyle, activeFrame: number): Readonly<HitRegion> {
  switch (style) {
    case AttackStyle.forwardAir:
      return activeFrame <= 1 ? FORWARD_AIR_LINK : activeFrame >= 4 ? FORWARD_AIR_LAUNCH : NO_HIT_REGION;
    case AttackStyle.jab3:
      return activeFrame <= 0 ? JAB3_RISE : activeFrame === 1 ? JAB3_CREST : JAB3_OVERHEAD;
    case AttackStyle.neutralAir:
      return activeFrame < DEMON_HUNTER_NEUTRAL_AIR_CLEAN_FRAMES ? NEUTRAL_AIR_CLEAN : NEUTRAL_AIR_LATE;
    default:
      return DEMON_HUNTER_REGIONS[style] ?? NO_HIT_REGION;
  }
}

const ordinary = (minX: number, maxX: number, minZ: number, maxZ: number, damage: number, launchX = DIAGONAL_UNIT) =>
  region(minX, maxX, minZ, maxZ, damage, ORDINARY_HIT_GROWTH_PERCENT, ORDINARY_HIT_BASE_KNOCKBACK, launchX, DIAGONAL_UNIT);


function reachRegion(style: AttackStyle): Readonly<HitRegion> {
  const verticalOffset = style === AttackStyle.forwardTiltUp ? 65.0 : style === AttackStyle.forwardTiltDown ? -65.0 : 0.0;
  const [minZ, maxZ] = [f32(verticalOffset - 130), f32(verticalOffset + 130)];
  // An angled forward tilt launches along its angle (smashcraft:docs/design/tilts.md): 55 degrees up, 20 down.
  if (style === AttackStyle.downSmash) {
    const row = ordinary(0.0, attackReach(style), minZ, maxZ, attackDamage(style));
    return { ...row, effect: downSmashHit(row.effect) };
  }
  if (style === AttackStyle.forwardTiltUp) return region(0.0, attackReach(style), minZ, maxZ, attackDamage(style), ORDINARY_HIT_GROWTH_PERCENT, ORDINARY_HIT_BASE_KNOCKBACK, 0.5735764503479004, 0.8191520571708679);
  if (style === AttackStyle.forwardTiltDown) return region(0.0, attackReach(style), minZ, maxZ, attackDamage(style), ORDINARY_HIT_GROWTH_PERCENT, ORDINARY_HIT_BASE_KNOCKBACK, 0.9396926164627075, 0.3420201539993286);
  return ordinary(0.0, attackReach(style), minZ, maxZ, attackDamage(style));
}

export const SHARED_GRAB_REGION: Readonly<HitRegion> = region(0.0, 96.0, 20.0, 70.0, 0.0, 0.0, 0.0, 0.0, 0.0);

const REACH_REGIONS: { readonly [style: number]: Readonly<HitRegion> } = {
  [AttackStyle.jab]: reachRegion(AttackStyle.jab),
  [AttackStyle.upSmash]: { ...reachRegion(AttackStyle.upSmash), strike: { x1: 20.0, z1: 60.0, x2: 62.0, z2: 150.0, radius: 30.0 } },
  [AttackStyle.downSmash]: { ...reachRegion(AttackStyle.downSmash), strike: { x1: 40.0, z1: 10.0, x2: 92.0, z2: -70.0, radius: 25.0 } },
  [AttackStyle.forwardSmash]: { ...reachRegion(AttackStyle.forwardSmash), strike: { x1: 20.0, z1: 42.0, x2: 105.0, z2: 5.0, radius: 12.0 } },
  [AttackStyle.grab]: reachRegion(AttackStyle.grab),
  [AttackStyle.upTilt]: reachRegion(AttackStyle.upTilt),
  [AttackStyle.downTilt]: reachRegion(AttackStyle.downTilt),
  [AttackStyle.forwardTiltUp]: reachRegion(AttackStyle.forwardTiltUp),
  [AttackStyle.forwardTiltDown]: reachRegion(AttackStyle.forwardTiltDown),
  [AttackStyle.demonHunterDashAttack]: reachRegion(AttackStyle.demonHunterDashAttack),
};

const FORWARD_TILT_TIP_EARLY = region(90.0, 145.0, -130.0, 130.0, 10.0, 110.0, 24.0, 0.800000011920929, 0.6000000238418579);
const FORWARD_TILT_TIP_LATE = region(90.0, 145.0, -130.0, 130.0, 8.0, 90.0, 18.0, 0.800000011920929, 0.6000000238418579);
const FORWARD_TILT_INNER_EARLY = region(0.0, 110.0, -130.0, 130.0, 7.0, 80.0, 16.0, DIAGONAL_UNIT, DIAGONAL_UNIT);
const FORWARD_TILT_INNER_LATE = region(0.0, 110.0, -130.0, 130.0, 5.0, 70.0, 12.0, DIAGONAL_UNIT, DIAGONAL_UNIT);
const LEDGE_ATTACK = ordinary(0.0, 140.0, -90.0, 90.0, attackDamage(AttackStyle.ledgeAttack));
const GETUP_ATTACK = region(
  -attackReach(AttackStyle.getupAttack), attackReach(AttackStyle.getupAttack), -130.0, 130.0,
  DOWN_ATTACK_DAMAGE, ORDINARY_HIT_GROWTH_PERCENT, DOWN_ATTACK_BASE_KNOCKBACK, DIAGONAL_UNIT, DIAGONAL_UNIT,
);
const NEUTRAL_AIR = { ...ordinary(-38.0, 90.0, 35.0, 55.0, attackDamage(AttackStyle.neutralAir)), strike: { x1: -28.0, z1: 45.0, x2: 80.0, z2: 45.0, radius: 10.0 } };
const NEUTRAL_AIR_LINGERING = { ...ordinary(-38.0, 90.0, 35.0, 55.0, 5.0), strike: { x1: -28.0, z1: 45.0, x2: 80.0, z2: 45.0, radius: 10.0 } };
const FORWARD_AIR = { ...ordinary(-2.0, 58.0, 10.0, 42.0, attackDamage(AttackStyle.forwardAir)), strike: { x1: 40.0, z1: 46.0, x2: 106.0, z2: 28.0, radius: 14.0 } };
const BACK_AIR = { ...ordinary(-72.0, 9.0, 41.0, 86.0, attackDamage(AttackStyle.backAir), -DIAGONAL_UNIT), strike: { x1: 8.0, z1: 48.0, x2: -38.0, z2: 60.0, radius: 14.0 } };
const BACK_AIR_LINGERING = { ...ordinary(-72.0, 9.0, 41.0, 86.0, 5.0, -DIAGONAL_UNIT), strike: { x1: 8.0, z1: 48.0, x2: -38.0, z2: 60.0, radius: 14.0 } };
const UP_AIR = { ...region(-28.0, 12.0, 60.0, 138.0, 4.0, 60.0, 14.0, 0.25, 0.968245804309845), strike: { x1: -8.0, z1: 80.0, x2: -8.0, z2: 118.0, radius: 20.0 } };
const UP_AIR_FINISHER = { ...region(-28.0, 12.0, 60.0, 138.0, 8.0, 110.0, 24.0, 0.25, 0.968245804309845, 2), strike: { x1: -8.0, z1: 80.0, x2: -8.0, z2: 118.0, radius: 20.0 } };
const DOWN_AIR = {
  ...region(-16.0, 22.0, -36.0, 28.0, attackDamage(AttackStyle.downAir), ORDINARY_HIT_GROWTH_PERCENT, ORDINARY_HIT_BASE_KNOCKBACK, 0.25, -0.968245804309845),
  strike: { x1: 2.0, z1: 10.0, x2: 4.0, z2: -18.0, radius: 18.0 },
};

const SHARED_UP_SMASH = reachRegion(AttackStyle.upSmash);

export function authoredHitRegionCount(style: AttackStyle | undefined, moves?: FighterMoves): number {
  const authored = style === undefined ? undefined : moves?.normals[style];
  if (style === AttackStyle.grab) return 1;
  if (authored !== undefined) return authored.regions.length;
  return style === AttackStyle.forwardTilt ? 2 : 1;
}

function activeRegion(character: Character, style: AttackStyle, frame: number, index: number): Readonly<HitRegion> {
  const startup = attackStartupFrames(style);

  if (character === Character.demonHunter && style !== AttackStyle.grab && style !== AttackStyle.getupAttack && style !== AttackStyle.ledgeAttack) {
    return demonHunterRegion(style, frame - startup);
  }
  switch (style) {
    case AttackStyle.forwardTilt: {
      const early = frame === startup;
      if (index === 0) return early ? FORWARD_TILT_TIP_EARLY : FORWARD_TILT_TIP_LATE;
      return early ? FORWARD_TILT_INNER_EARLY : FORWARD_TILT_INNER_LATE;
    }
    case AttackStyle.ledgeAttack:
      return LEDGE_ATTACK;
    case AttackStyle.getupAttack:
      return GETUP_ATTACK;
    case AttackStyle.neutralAir:
      return frame >= 7 ? NEUTRAL_AIR_LINGERING : NEUTRAL_AIR;
    case AttackStyle.forwardAir:
      return FORWARD_AIR;
    case AttackStyle.backAir:
      return frame >= 7 ? BACK_AIR_LINGERING : BACK_AIR;
    case AttackStyle.upAir:
      return frame === startup + 2 ? UP_AIR_FINISHER : UP_AIR;
    case AttackStyle.downAir:
      return DOWN_AIR;
    case AttackStyle.upSmash:
      return REACH_REGIONS[style] ?? NO_HIT_REGION;
    default:
      return REACH_REGIONS[style] ?? NO_HIT_REGION;
  }
}






function grabHitRegion(frame: number, index: number, moves?: FighterMoves): Readonly<HitRegion> {
  const startup = attackStartupFrames(AttackStyle.grab, moves);
  if (index !== 0 || frame < startup || frame >= startup + 3) return NO_HIT_REGION;
  return moves?.grabRegion ?? SHARED_GRAB_REGION;
}

export function authoredHitRegion(out: HitRegion, character: Character, style: AttackStyle | undefined, frame: number, chargeFrames: number, index: number, moves?: FighterMoves): HitRegion {
  if (style === AttackStyle.grab) {
    copyHitRegion(out, grabHitRegion(frame, index, moves));
    return out;
  }
  const authored = style === undefined ? undefined : moves?.normals[style];
  if (authored !== undefined) {
    const region = authored.regions[index];
    copyHitRegion(out, region !== undefined && frame >= region.firstFrame && frame <= region.lastFrame ? region.hit : NO_HIT_REGION);
    if (isSmashAttack(style)) out.effect.damage = f32(out.effect.damage * smashDamageMultiplier(chargeFrames));
    return out;
  }
  if (style === undefined || style === AttackStyle.shot) {
    copyHitRegion(out, NO_HIT_REGION);
    return out;
  }
  const startup = attackStartupFrames(style);
  if (frame < startup || frame >= startup + characterAttackActiveFrames(character, style)) {
    copyHitRegion(out, NO_HIT_REGION);
    return out;
  }
  copyHitRegion(out, activeRegion(character, style, frame, index));
  if (character === Character.demonHunter) out.effect.element = HitElement.slash;
  if (isSmashAttack(style)) out.effect.damage = f32(out.effect.damage * smashDamageMultiplier(chargeFrames));
  return out;
}
