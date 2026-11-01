import { Character } from "../../sim/codes";
import { type Duel, stickDuel } from "../stickDuel";

export { type Duel, type Press, type Stick, idle, lift, placeFoe, step } from "../stickDuel";

export const duel = (foeAhead: number, facing = 1, casterX = 0.0): Duel => stickDuel(Character.firelord, Character.peon, foeAhead, facing, casterX);
