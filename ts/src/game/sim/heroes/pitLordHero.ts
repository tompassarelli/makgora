

import { Character } from "../codes";
import type { HeroDefinition } from "./hero";
import { PIT_LORD_GAMEPLAN } from "./pitLordGameplan";
import { PIT_LORD_MOVES } from "./pitLordMoves";
import { PIT_LORD_SPECIALS } from "./pitLordSpecials";

export const PIT_LORD_HERO: HeroDefinition = {
  character: Character.pitLord,
  name: "Pit Lord",
  purpose: "Siege heavyweight: falling fire and long cleaves",
  weakness: "Very large target and slow recovery",
  jab: { name: "Haft and Chop", description: "A haft check, then a short cleaver chop on a second jab." },
  complete: true,
  moves: PIT_LORD_MOVES,
  specials: PIT_LORD_SPECIALS,
  gameplan: PIT_LORD_GAMEPLAN,
};
