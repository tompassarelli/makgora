

import { Character } from "../codes";
import type { HeroDefinition } from "./hero";
import { BLADEMASTER_GAMEPLAN } from "./blademasterGameplan";
import { BLADEMASTER_MOVES } from "./blademasterMoves";
import { BLADEMASTER_SPECIALS } from "./blademasterSpecials";

export const BLADEMASTER_HERO: HeroDefinition = {
  character: Character.blademaster,
  name: "Blademaster",
  purpose: "Grounded sword spacing and whiff punishment",
  weakness: "Exposed recoveries and weak ranged pressure",
  complete: true,
  moves: BLADEMASTER_MOVES,
  specials: BLADEMASTER_SPECIALS,
  jab: { name: "Swift Cuts", description: "Two quick cuts close to his body on repeated jabs." },
  gameplan: BLADEMASTER_GAMEPLAN,
};
