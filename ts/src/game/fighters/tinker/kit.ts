import { Character } from "../../sim/codes";
import type { HeroDefinition } from "../../sim/heroes/hero";
import { TINKER_MOVES } from "./moves";
import { TINKER_SPECIALS } from "./specials";
import { TINKER_GAMEPLAN } from "./gameplan";

export const TINKER_HERO: HeroDefinition = {
  character: Character.tinker, name: "Goblin Tinker", displayName: "Gazlowe", purpose: "Factory and rocket space control",
  weakness: "Short claws and vulnerable setup",
  jab: { name: "Claw-Pack", description: "Two short claw taps and a wrench shove." },
  complete: true, moves: TINKER_MOVES, specials: TINKER_SPECIALS, gameplan: TINKER_GAMEPLAN,
};
