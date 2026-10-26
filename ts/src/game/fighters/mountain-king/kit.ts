

import { Character } from "../../sim/codes";
import type { HeroDefinition } from "../../sim/heroes/hero";
import { MOUNTAIN_KING_GAMEPLAN } from "./gameplan";
import { MOUNTAIN_KING_MOVES } from "./moves";
import { MOUNTAIN_KING_SPECIALS } from "./specials";

export const MOUNTAIN_KING_HERO: HeroDefinition = {
  character: Character.mountainKing,
  name: "Mountain King",
  displayName: "Muradin Bronzebeard",
  purpose: "Compact heavy with hammer and axe",
  weakness: "Slow approach and limited air drift",
  complete: true,
  moves: MOUNTAIN_KING_MOVES,
  specials: MOUNTAIN_KING_SPECIALS,
  jab: { name: "Tavern Brawl", description: "A short punch, then a heavy hook on a second jab." },
  gameplan: MOUNTAIN_KING_GAMEPLAN,
};
