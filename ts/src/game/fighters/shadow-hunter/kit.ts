

import { Character } from "../../sim/codes";
import type { HeroDefinition } from "../../sim/heroes/hero";
import { SHADOW_HUNTER_GAMEPLAN } from "./gameplan";
import { SHADOW_HUNTER_MOVES } from "./moves";
import { SHADOW_HUNTER_SPECIALS } from "./specials";

export const SHADOW_HUNTER_HERO: HeroDefinition = {
  character: Character.shadowHunter,
  name: "Shadow Hunter",
  displayName: "Rokhan",
  purpose: "Totem placement and angles",
  weakness: "Setup can be destroyed or bypassed",
  complete: true,
  moves: SHADOW_HUNTER_MOVES,
  specials: SHADOW_HUNTER_SPECIALS,
  jab: { name: "Glaive Handle", description: "Two jabs of the glaive handle, then a cut of its blade, on repeated jabs." },
  gameplan: SHADOW_HUNTER_GAMEPLAN,
};
