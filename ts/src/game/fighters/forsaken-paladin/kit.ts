

import { Character } from "../../sim/codes";
import type { HeroDefinition } from "../../sim/heroes/hero";
import { FORSAKEN_PALADIN_MOVES } from "./moves";
import { FORSAKEN_PALADIN_GAMEPLAN } from "./gameplan";
import { FORSAKEN_PALADIN_SPECIALS } from "./specials";
import { fitMoves, fitSpecials } from "../../sim/weaponRegions";
import { FORSAKEN_PALADIN_WEAPON_REGIONS } from "./weaponRegions";

export const FORSAKEN_PALADIN_HERO: HeroDefinition = {
  character: Character.forsakenPaladin,
  name: "Forsaken Paladin",
  purpose: "Forsaken sword fighter who holds consecrated ground",
  weakness: "Slow feet and punishable sword commitments",
  complete: true,
  moves: fitMoves(FORSAKEN_PALADIN_MOVES, FORSAKEN_PALADIN_WEAPON_REGIONS),
  specials: fitSpecials(FORSAKEN_PALADIN_SPECIALS, FORSAKEN_PALADIN_WEAPON_REGIONS),
  jab: { name: "Blade and Hilt", description: "A sword check, then a shove of the hilt on a second jab." },
  gameplan: FORSAKEN_PALADIN_GAMEPLAN,
};
