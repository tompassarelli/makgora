import { Character } from "../../sim/codes";
import type { HeroDefinition } from "../../sim/heroes/hero";
import { UTHER_MOVES } from "./moves";
import { UTHER_SPECIALS } from "./specials";
import { UTHER_GAMEPLAN } from "./gameplan";

export const UTHER_HERO: HeroDefinition = {
  character: Character.uther,
  name: "Uther",
  purpose: "The Silver Hand's stern hammer, with an answer for every situation",
  weakness: "Slow air drift and no long-range pressure",
  complete: true,
  moves: UTHER_MOVES,
  specials: UTHER_SPECIALS,
  jab: { name: "Haft and Gauntlet", description: "A check with the hammer's haft, then a gauntlet backhand." },
  gameplan: UTHER_GAMEPLAN,
};
