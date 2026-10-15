import { Character } from "../codes";
import type { HeroDefinition } from "./hero";
import { GROM_MOVES } from "./gromMoves";
import { GROM_SPECIALS } from "./gromSpecials";
import { GROM_GAMEPLAN } from "./gromGameplan";
export const GROM_HERO: HeroDefinition = {
  character: Character.grom, name: "Grom Hellscream", purpose: "Reckless rush-down bruiser", weakness: "Committed axe swings and a predictable leap", complete: true,
  moves: GROM_MOVES, specials: GROM_SPECIALS, gameplan: GROM_GAMEPLAN,
  jab: { name: "Warsong Greeting", description: "Check them with the hilt, then chop on a second tap." },
};
