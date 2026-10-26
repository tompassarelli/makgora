

import { Character } from "../../sim/codes";
import type { HeroDefinition } from "../../sim/heroes/hero";
import { BEASTMASTER_GAMEPLAN } from "./gameplan";
import { BEASTMASTER_MOVES } from "./moves";
import { BEASTMASTER_SPECIALS } from "./specials";

export const BEASTMASTER_HERO: HeroDefinition = {
  character: Character.beastmaster,
  name: "Beastmaster",
  displayName: "Rexxar",
  purpose: "Three-animal pack coordination",
  weakness: "Shared resources and punishable pet commands",
  jab: { name: "Twin Axes", description: "Both axe hilts, then a shoulder that shoves, on repeated jabs." },
  complete: true,
  moves: BEASTMASTER_MOVES,
  specials: BEASTMASTER_SPECIALS,
  gameplan: BEASTMASTER_GAMEPLAN,
};
