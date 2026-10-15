

import { Character } from "../codes";
import type { HeroDefinition } from "./hero";
import { FORSAKEN_PALADIN_MOVES } from "./forsakenPaladinMoves";
import { FORSAKEN_PALADIN_GAMEPLAN } from "./forsakenPaladinGameplan";
import { FORSAKEN_PALADIN_SPECIALS } from "./forsakenPaladinSpecials";

export const FORSAKEN_PALADIN_HERO: HeroDefinition = {
  character: Character.forsakenPaladin,
  name: "Forsaken Paladin",
  purpose: "Forsaken sword fighter who holds consecrated ground",
  weakness: "Slow feet and punishable sword commitments",
  complete: true,
  moves: FORSAKEN_PALADIN_MOVES,
  specials: FORSAKEN_PALADIN_SPECIALS,
  jab: { name: "Blade and Hilt", description: "A sword check, then a shove of the hilt on a second jab." },
  gameplan: FORSAKEN_PALADIN_GAMEPLAN,
};
