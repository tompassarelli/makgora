import type { SpecialCharge } from "./schema";

/** The fewest banked frames at which a move that starts holding this charge swings it at once. */
export const chargeSwingFloor = (charge: Readonly<SpecialCharge>): number => charge.releases === true ? 1 : charge.full;

/** Whether the move keeps holding its charge frame with this much banked. */
export const chargeHolds = (charge: Readonly<SpecialCharge>, banked: number): boolean => banked < charge.full || charge.releases === true;

export const chargeBanked = (charge: Readonly<SpecialCharge>, banked: number): number => Math.min(charge.full, banked + 1);
