import { Character } from "../../sim/codes";
import type { HeroDefinition } from "../../sim/heroes/hero";
import { JAINA_GAMEPLAN } from "./gameplan";
import { JAINA_MOVES } from "./moves";
import { JAINA_SPECIALS } from "./specials";

export const JAINA_HERO: HeroDefinition = {
  character: Character.jaina, name: "Jaina Proudmoore", purpose: "Frost spells and a Water Elemental control the approach",
  weakness: "Slow on foot and exposed while setting up spells", complete: true,
  moves: JAINA_MOVES, specials: JAINA_SPECIALS, gameplan: JAINA_GAMEPLAN,
  jab: { name: "Staff Check", description: "Two short staff strikes to create space." },
};
