

import { Character } from "../codes";
import type { HeroDefinition } from "./hero";
import { SHADOW_HUNTER_GAMEPLAN } from "./shadowHunterGameplan";
import { SHADOW_HUNTER_MOVES } from "./shadowHunterMoves";
import { SHADOW_HUNTER_SPECIALS } from "./shadowHunterSpecials";

export const SHADOW_HUNTER_HERO: HeroDefinition = {
  character: Character.shadowHunter,
  name: "Shadow Hunter",
  purpose: "Totem placement and angles",
  weakness: "Setup can be destroyed or bypassed",
  complete: true,
  moves: SHADOW_HUNTER_MOVES,
  specials: SHADOW_HUNTER_SPECIALS,
  jab: { name: "Glaive Handle", description: "Two jabs of the glaive handle, then a cut of its blade, on repeated jabs." },
  gameplan: SHADOW_HUNTER_GAMEPLAN,
};
