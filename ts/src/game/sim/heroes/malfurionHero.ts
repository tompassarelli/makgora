import { Character } from "../codes";
import type { HeroDefinition } from "./hero";
import { MALFURION_GAMEPLAN } from "./malfurionGameplan";
import { MALFURION_MOVES } from "./malfurionMoves";
import { MALFURION_SPECIALS } from "./malfurionSpecials";

export const MALFURION_HERO: HeroDefinition = {
  character: Character.malfurion, name: "Malfurion Stormrage", purpose: "A serene archdruid traps the ground, then dismisses intruders",
  weakness: "Tall, slow and exposed while planting his traps", complete: true,
  moves: MALFURION_MOVES, specials: MALFURION_SPECIALS, gameplan: MALFURION_GAMEPLAN,
  jab: { name: "Gardening Lesson", description: "Two dismissive staff taps: mind the flowers." },
};
