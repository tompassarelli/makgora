

import { Character } from "../../sim/codes";
import type { HeroDefinition } from "../../sim/heroes/hero";
import { PIT_LORD_GAMEPLAN } from "./gameplan";
import { PIT_LORD_MOVES } from "./moves";
import { PIT_LORD_SPECIALS } from "./specials";

export const PIT_LORD_HERO: HeroDefinition = {
  character: Character.pitLord,
  name: "Pit Lord",
  purpose: "Siege heavyweight: falling fire and long cleaves",
  weakness: "Very large target and slow recovery",
  jab: { name: "Haft and Chop", description: "A haft check, then a short cleaver chop on a second jab." },
  complete: true,
  nonWeaponStrikes: { spell: ["neutral-special", "up-special"] },
  moves: PIT_LORD_MOVES,
  specials: PIT_LORD_SPECIALS,
  gameplan: PIT_LORD_GAMEPLAN,
};
