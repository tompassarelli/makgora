import type { SpecialCharge } from "./schema";

/** Whether the move keeps holding its charge frame with this much banked. */
export const chargeHolds = (charge: Readonly<SpecialCharge>, banked: number): boolean => banked < charge.full || charge.releases === true;

export const chargeBanked = (charge: Readonly<SpecialCharge>, banked: number): number => Math.min(charge.full, banked + 1);
