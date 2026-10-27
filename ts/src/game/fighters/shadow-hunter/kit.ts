

import { Character } from "../../sim/codes";
import type { HeroDefinition } from "../../sim/heroes/hero";
import { SHADOW_HUNTER_GAMEPLAN } from "./gameplan";
import { SHADOW_HUNTER_MOVES } from "./moves";
import { SHADOW_HUNTER_SPECIALS } from "./specials";

export const SHADOW_HUNTER_HERO: HeroDefinition = {
  character: Character.shadowHunter,
  name: "Shadow Hunter",
  purpose: "Totem placement and angles",
  weakness: "Setup can be destroyed or bypassed",
  complete: true,
  nonWeaponStrikes: { limb: ["jab", "forward-tilt", "forward-tilt-up", "forward-tilt-down", "up-tilt", "down-tilt", "dash-attack"] },
  moves: SHADOW_HUNTER_MOVES,
  specials: SHADOW_HUNTER_SPECIALS,
  jab: { name: "Glaive Handle", description: "Two jabs of the glaive handle, then a cut of its blade, on repeated jabs." },
  gameplan: SHADOW_HUNTER_GAMEPLAN,
};
