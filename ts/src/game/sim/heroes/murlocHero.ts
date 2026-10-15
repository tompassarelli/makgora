
import { Character } from "../codes";
import type { HeroDefinition } from "./hero";
import { MURLOC_GAMEPLAN } from "./murlocGameplan";
import { MURLOC_MOVES } from "./murlocMoves";
import { MURLOC_SPECIALS } from "./murlocSpecials";

export const MURLOC_HERO: HeroDefinition = {
  character: Character.murloc,
  name: "Murloc",
  purpose: "Small, light rushdown",
  weakness: "Short reach, early knockouts and a short recovery",
  jab: { name: "Claw Flurry", description: "A quick claw poke, then a second swipe on another tap." },
  complete: true,
  moves: MURLOC_MOVES,
  specials: MURLOC_SPECIALS,
  gameplan: MURLOC_GAMEPLAN,
};
