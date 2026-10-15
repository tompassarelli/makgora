import { Character } from "../codes";
import type { HeroDefinition } from "./hero";
import { THRALL_MOVES } from "./thrallMoves";
import { THRALL_SPECIALS } from "./thrallSpecials";
import { THRALL_GAMEPLAN } from "./thrallGameplan";

export const THRALL_HERO: HeroDefinition = {
  character: Character.thrall, name: "Thrall", purpose: "Heavy hammer brawler with lightning and spirit wolves", weakness: "Slow air drift and an exposed recovery",
  complete: true, moves: THRALL_MOVES, specials: THRALL_SPECIALS, gameplan: THRALL_GAMEPLAN,
  jab: { name: "Doomhammer", description: "Check with the handle, then press again for a short hammer hook." },
};
