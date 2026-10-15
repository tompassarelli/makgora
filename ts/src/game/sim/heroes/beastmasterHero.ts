

import { Character } from "../codes";
import type { HeroDefinition } from "./hero";
import { BEASTMASTER_GAMEPLAN } from "./beastmasterGameplan";
import { BEASTMASTER_MOVES } from "./beastmasterMoves";
import { BEASTMASTER_SPECIALS } from "./beastmasterSpecials";

export const BEASTMASTER_HERO: HeroDefinition = {
  character: Character.beastmaster,
  name: "Beastmaster",
  purpose: "Three-animal pack coordination",
  weakness: "Shared resources and punishable pet commands",
  jab: { name: "Twin Axes", description: "Both axe hilts, then a shoulder that shoves, on repeated jabs." },
  complete: true,
  moves: BEASTMASTER_MOVES,
  specials: BEASTMASTER_SPECIALS,
  gameplan: BEASTMASTER_GAMEPLAN,
};
