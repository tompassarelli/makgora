import { AttackStyle } from "../../src/game/sim/codes";
import { WARDEN_MOVES } from "../../src/game/sim/heroes/wardenMoves";
import type { HitEffect } from "../../src/game/sim/hitRegions";
import { type LedgerRow, PARITY, shortNumber } from "./row";

export const FOX_NEUTRAL_AIR = { damage: 12, base: 10, growth: 100, angle: "361" } as const;

const FOX_NEUTRAL_AIR_PAGE = "https://www.ssbwiki.com/Fox_(SSBM)/Neutral_aerial";
const WARDEN = "ts/src/game/sim/heroes/wardenMoves.ts";
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
];
