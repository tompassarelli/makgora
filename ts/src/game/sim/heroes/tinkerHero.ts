import { Character } from "../codes";
import type { HeroDefinition } from "./hero";
import { TINKER_MOVES } from "./tinkerMoves";
import { TINKER_SPECIALS } from "./tinkerSpecials";
import { TINKER_GAMEPLAN } from "./tinkerGameplan";

export const TINKER_HERO: HeroDefinition = {
  character: Character.tinker, name: "Goblin Tinker", purpose: "Factory and rocket space control",
  weakness: "Short claws and vulnerable setup",
  jab: { name: "Claw-Pack", description: "Two short claw taps and a wrench shove." },
  complete: true, moves: TINKER_MOVES, specials: TINKER_SPECIALS, gameplan: TINKER_GAMEPLAN,
};
