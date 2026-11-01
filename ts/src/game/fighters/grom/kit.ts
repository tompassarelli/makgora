import { Character } from "../../sim/codes";
import type { HeroDefinition } from "../../sim/heroes/hero";
import { GROM_MOVES } from "./moves";
import { GROM_SPECIALS } from "./specials";
import { GROM_GAMEPLAN } from "./gameplan";
export const GROM_HERO: HeroDefinition = {
  character: Character.grom, name: "Grom Hellscream", displayName: "Grom", purpose: "Reckless rush-down bruiser", weakness: "Committed axe swings and a predictable leap", complete: true,
  moves: GROM_MOVES, specials: GROM_SPECIALS, gameplan: GROM_GAMEPLAN,
  jab: { name: "Warsong Greeting", description: "Check them with the hilt, then chop on a second tap." },
};
