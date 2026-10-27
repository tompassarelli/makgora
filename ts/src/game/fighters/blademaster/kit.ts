

import { Character } from "../../sim/codes";
import type { HeroDefinition } from "../../sim/heroes/hero";
import { BLADEMASTER_GAMEPLAN } from "./gameplan";
import { BLADEMASTER_MOVES } from "./moves";
import { BLADEMASTER_SPECIALS } from "./specials";
import { fitMoves, fitSpecials } from "../../sim/weaponRegions";
import { BLADEMASTER_WEAPON_REGIONS } from "./weaponRegions";

export const BLADEMASTER_HERO: HeroDefinition = {
  character: Character.blademaster,
  name: "Blademaster",
  displayName: "Samuro",
  purpose: "Grounded sword spacing and whiff punishment",
  weakness: "Exposed recoveries and weak ranged pressure",
  complete: true,
  moves: fitMoves(BLADEMASTER_MOVES, BLADEMASTER_WEAPON_REGIONS),
  specials: fitSpecials(BLADEMASTER_SPECIALS, BLADEMASTER_WEAPON_REGIONS),
  jab: { name: "Swift Cuts", description: "Two quick cuts close to his body on repeated jabs." },
  gameplan: BLADEMASTER_GAMEPLAN,
};
