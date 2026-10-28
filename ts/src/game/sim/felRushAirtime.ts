// Fel Rush's airtime bits: the airtime's rush, the earned (aimed) second, the earned charge, and two for the rush in progress.
export const FEL_RUSH_AIRTIME = 2;
export const FEL_RUSH_AIMED_AIRTIME = 4;
export const FEL_RUSH_EARNED = 8;
export const FEL_RUSH_STRUCK = 16;
export const FEL_RUSH_FROM_AIR = 32;
export const FEL_RUSH_IN_PROGRESS = FEL_RUSH_STRUCK | FEL_RUSH_FROM_AIR;
