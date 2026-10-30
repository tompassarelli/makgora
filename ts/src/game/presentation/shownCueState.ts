import { swapSplashing } from "../fighters/murloc/duo";
import { SpecialAction } from "../sim/codes";
import type { Fighter } from "../sim/fighter";
import { ACTIVE_CUE_FRAMES } from "./cueWindows";
import { type CueState, SWAP_SPLASH_CUES, specialCueState } from "./specialCues";

const SWAP_SPLASH_STATE: CueState = { cues: SWAP_SPLASH_CUES, phase: "active" };

export const shownCueState = (fighter: Readonly<Fighter>): CueState =>
  fighter.special.action === SpecialAction.none && swapSplashing(fighter, ACTIVE_CUE_FRAMES) ? SWAP_SPLASH_STATE : specialCueState(fighter);
