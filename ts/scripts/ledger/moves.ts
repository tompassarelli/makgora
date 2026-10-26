import { AttackStyle, Character } from "../../src/game/sim/codes";
import { MURLOC_MOVES } from "../../src/game/sim/heroes/murlocMoves";
import { WARDEN_MOVES } from "../../src/game/sim/heroes/wardenMoves";
import { authoredHitRegion, emptyHitRegion, type HitEffect } from "../../src/game/sim/hitRegions";
import { attackStartupFrames } from "../../src/game/sim/moves";
import { type LedgerRow, PARITY, shortNumber } from "./row";

export const FOX_NEUTRAL_AIR = { damage: 12, base: 10, growth: 100, angle: "361" } as const;

const FOX_NEUTRAL_AIR_PAGE = "https://www.ssbwiki.com/Fox_(SSBM)/Neutral_aerial";
const WARDEN = "ts/src/game/sim/heroes/wardenMoves.ts";
const MURLOC = "ts/src/game/sim/heroes/murlocMoves.ts";
const DEMON_HUNTER = "ts/src/game/sim/hitRegions.ts";
const FOX_DOWN_TILT = { undocumented: "Fox's down tilt sweeps his tail along the floor, and no Melee page gives its reach in units", source: "https://www.ssbwiki.com/Fox_(SSBM)/Down_tilt" } as const;
const LEG_SWEEP = { kind: "deviation", reason: "the down tilt is a low leg sweep, so its region follows the sweeping leg along the floor in front and keeps the old reach; frame data, damage and knockback are unchanged", decided: "2026-10-26", issue: 517 } as const;
const SQUIRTLE_JAB = { undocumented: "Murloc's jab follows Squirtle's, who is not in Melee, and no Melee page gives a jab's reach in units", source: "https://www.ssbwiki.com/Squirtle_(SSBB)/Neutral_attack" } as const;
const SPEAR_POINT = { kind: "deviation", reason: "his jab regions run to the spear point, so the point-first stabs hit where the point lands; frame data, damage and knockback are unchanged", decided: "2026-10-26", issue: 497 } as const;
const LOW_KNOCKBACK = { kind: "deviation", reason: "Fox's 12% at base 10, growth 100 passes the Sakurai angle's 32 at 0% and lifts a grounded victim at 44 degrees, so it techs before her frame-14 jab or frame-18 grab; 6.1% at base 28.5, growth 8 stays 30-32 from 0 to 30% and keeps it grounded with 12 frames of hitstun, which makes her neutral air into grab and jab hold", decided: "2026-10-26", issue: 305 } as const;

export function maievNeutralAir(): HitEffect[] {
  const regions = WARDEN_MOVES.normals[AttackStyle.neutralAir]?.regions ?? [];
  return [...new Set(regions.flatMap((region) => [region.hit.effect, ...(region.hit.groundedEffect === undefined ? [] : [region.hit.groundedEffect as HitEffect])]))];
}

function only<T>(read: (effect: HitEffect) => T): T {
  const values = [...new Set(maievNeutralAir().map(read))];
  const [value] = values;
  if (values.length !== 1 || value === undefined) throw new Error(`Maiev's neutral air hits disagree: ${values.join(", ")}`);
  return value;
}

function murlocReach(style: AttackStyle): number {
  const region = MURLOC_MOVES.normals[style]?.regions[0];
  if (region === undefined) throw new Error(`Murloc's attack style ${style} has no hit region`);
  return region.hit.maxX;
}

function maievDownTiltReach(): number {
  const regions = WARDEN_MOVES.normals[AttackStyle.downTilt]?.regions ?? [];
  if (regions.length === 0) throw new Error("Maiev's down tilt has no hit region");
  return Math.max(...regions.map((region) => region.hit.maxX));
}

const illidanDownTiltReach = (): number => authoredHitRegion(emptyHitRegion(), Character.demonHunter, AttackStyle.downTilt, attackStartupFrames(AttackStyle.downTilt), 0, 0).maxX;

const angle = (effect: HitEffect): string => (effect.sakurai === true ? FOX_NEUTRAL_AIR.angle : `${Math.round((Math.atan2(effect.launchZ, Math.abs(effect.launchX)) * 180) / Math.PI)}°`);

export const MOVE_ROWS: readonly LedgerRow[] = [
  {
    id: "maiev-neutral-air-angle", family: "moves", name: "Maiev's neutral air launch angle",
    melee: { value: FOX_NEUTRAL_AIR.angle, source: FOX_NEUTRAL_AIR_PAGE }, ours: () => only(angle),
    anchor: { file: WARDEN, symbol: "WARDEN_MOVES" }, status: PARITY,
  },
  {
    id: "maiev-neutral-air-damage", family: "moves", name: "Maiev's neutral air damage",
    melee: { value: FOX_NEUTRAL_AIR.damage, source: FOX_NEUTRAL_AIR_PAGE }, ours: () => only((effect) => effect.damage),
    anchor: { file: WARDEN, symbol: "WARDEN_MOVES" }, status: LOW_KNOCKBACK,
  },
  {
    id: "maiev-neutral-air-knockback", family: "moves", name: "Maiev's neutral air base knockback and growth",
    melee: { value: `base ${FOX_NEUTRAL_AIR.base}, growth ${FOX_NEUTRAL_AIR.growth}`, source: FOX_NEUTRAL_AIR_PAGE },
    ours: () => only((effect) => `base ${shortNumber(effect.base)}, growth ${shortNumber(effect.growth)}`),
    anchor: { file: WARDEN, symbol: "WARDEN_MOVES" }, status: LOW_KNOCKBACK,
  },
  {
    id: "murloc-jab-reach", family: "moves", name: "Murloc's jab 1 reach",
    melee: SQUIRTLE_JAB, ours: () => murlocReach(AttackStyle.jab),
    anchor: { file: MURLOC, symbol: "MURLOC_MOVES" }, status: SPEAR_POINT,
  },
  {
    id: "murloc-jab2-reach", family: "moves", name: "Murloc's jab 2 reach",
    melee: SQUIRTLE_JAB, ours: () => murlocReach(AttackStyle.jab2),
    anchor: { file: MURLOC, symbol: "MURLOC_MOVES" }, status: SPEAR_POINT,
  },
  {
    id: "maiev-down-tilt-reach", family: "moves", name: "Maiev's down tilt reach",
    melee: FOX_DOWN_TILT, ours: maievDownTiltReach,
    anchor: { file: WARDEN, symbol: "WARDEN_MOVES" }, status: LEG_SWEEP,
  },
  {
    id: "illidan-down-tilt-reach", family: "moves", name: "Illidan's down tilt reach",
    melee: FOX_DOWN_TILT, ours: illidanDownTiltReach,
    anchor: { file: DEMON_HUNTER, symbol: "DEMON_HUNTER_REGIONS" }, status: LEG_SWEEP,
  },
];
