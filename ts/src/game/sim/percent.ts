import { min } from "../core/numbers";


export const MAX_PERCENT = 999.0;

export const capPercent = (percent: number): number => min(percent, MAX_PERCENT);
