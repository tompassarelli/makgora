import { Character } from "../codes";
import type { HeroDefinition } from "./hero";
import { PEON_MOVES } from "./peonMoves";
import { PEON_SPECIALS } from "./peonSpecials";
import { PEON_GAMEPLAN } from "./peonGameplan";

export const PEON_HERO: HeroDefinition = {
  character: Character.peon,
  name: "Peon",
  purpose: "A stubborn worker who fights around his burrow",
  weakness: "Slow feet, short tools and a fragile worksite",
  complete: true,
  moves: PEON_MOVES,
  specials: PEON_SPECIALS,
  jab: { name: "Work Work", description: "A quick haft tap followed by a short axe chop." },
  gameplan: PEON_GAMEPLAN,
};
