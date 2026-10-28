import { f32 } from "wisp/src/sim/f32";
import { divideFloat32, multiplyFloat32, subtractFloat32, toInt } from "wisp/src/sim/binary32";
import { ContactKind, HeroStatusGroup, HeroStatusKind } from "./codes";
import type { Fighter } from "./fighter";
import type { AppliedStatus } from "./appliedStatus";
import { ULTIMATE_FRAMES_PER_PERCENT } from "./meter";

export const MANA_SHIELD_SHARE = 0.5;
export const MANA_SHIELD_FRAMES_PER_PERCENT = f32(ULTIMATE_FRAMES_PER_PERCENT);
export const MANA_SHIELD_BREAK: AppliedStatus = { kind: HeroStatusKind.stun, frames: 20, group: HeroStatusGroup.sleep, immunityFrames: 0 };

export function toggleManaShield(f: Fighter): void {
  f.status.manaShield = !f.status.manaShield;
}

export function manaShieldTakes(kind: ContactKind): boolean {
  return kind !== ContactKind.throw && kind !== ContactKind.pummel;
}

export function shieldedDamage(f: Fighter, damage: number, kind: ContactKind): number {
  if (!f.status.manaShield || damage <= 0.0 || !manaShieldTakes(kind)) return damage;
  const share = multiplyFloat32(damage, MANA_SHIELD_SHARE);
  const cost = toInt(multiplyFloat32(share, MANA_SHIELD_FRAMES_PER_PERCENT));
  if (f.meter.ultimate > cost) {
    f.meter.ultimate -= cost;
    return subtractFloat32(damage, share);
  }
  const absorbed = divideFloat32(f.meter.ultimate, MANA_SHIELD_FRAMES_PER_PERCENT);
  f.meter.ultimate = 0;
  f.status.manaShield = false;
  return subtractFloat32(damage, absorbed);
}
