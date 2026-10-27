import { Character } from "../../sim/codes";
import type { HeroDefinition } from "../../sim/heroes/hero";
import { JAINA_GAMEPLAN } from "./gameplan";
import { JAINA_MOVES } from "./moves";
import { JAINA_SPECIALS } from "./specials";
import { fitMoves, fitSpecials } from "../../sim/weaponRegions";
import { JAINA_WEAPON_REGIONS } from "./weaponRegions";

export const JAINA_HERO: HeroDefinition = {
  character: Character.jaina, name: "Jaina Proudmoore", purpose: "Frost spells and a Water Elemental control the approach",
  weakness: "Slow on foot and exposed while setting up spells", complete: true,
  moves: fitMoves(JAINA_MOVES, JAINA_WEAPON_REGIONS), specials: fitSpecials(JAINA_SPECIALS, JAINA_WEAPON_REGIONS), gameplan: JAINA_GAMEPLAN,
  jab: { name: "Staff Check", description: "Two short staff strikes to create space." },
};
