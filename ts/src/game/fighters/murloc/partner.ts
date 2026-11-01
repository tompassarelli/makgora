import { f32 } from "wisp/src/sim/f32";
import { DuoRole } from "../../sim/codes";
import type { PartnerBody } from "../../sim/heroMoves";

export const MURLOC_PARTNER = {
  weight: f32(0.80),
  taken: f32(1.02),
  partnerDamage: 0.75,
  soloDamage: f32(0.9),
} as const;

export const MURLOC_PARTNER_BODY: PartnerBody = { weight: MURLOC_PARTNER.weight, taken: MURLOC_PARTNER.taken };

export function murlocDamageScale(role: number, partnerLive: boolean): number {
  if (role === DuoRole.partner) return MURLOC_PARTNER.partnerDamage;
  return partnerLive ? 1.0 : MURLOC_PARTNER.soloDamage;
}
