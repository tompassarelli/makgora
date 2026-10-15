import { Character } from "../codes";
import type { HeroDefinition } from "./hero";
import { JAINA_GAMEPLAN } from "./jainaGameplan";
import { JAINA_MOVES } from "./jainaMoves";
import { JAINA_SPECIALS } from "./jainaSpecials";

export const JAINA_HERO: HeroDefinition = {
  character: Character.jaina, name: "Jaina Proudmoore", purpose: "Frost spells and a Water Elemental control the approach",
  weakness: "Slow on foot and exposed while setting up spells", complete: true,
  moves: JAINA_MOVES, specials: JAINA_SPECIALS, gameplan: JAINA_GAMEPLAN,
  jab: { name: "Staff Check", description: "Two short staff strikes to create space." },
};
