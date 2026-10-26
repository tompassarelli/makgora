

import { Character } from "../../sim/codes";
import type { HeroDefinition } from "../../sim/heroes/hero";
import { DREADLORD_GAMEPLAN } from "./gameplan";
import { DREADLORD_MOVES } from "./moves";
import { DREADLORD_SPECIALS } from "./specials";

export const DREADLORD_HERO: HeroDefinition = {
  character: Character.dreadlord,
  name: "Dreadlord",
  displayName: "Mal'Ganis",
  purpose: "Air movement, grabs, and close pressure",
  weakness: "Large hurtbox and no safe long-range approach",
  complete: true,
  moves: DREADLORD_MOVES,
  specials: DREADLORD_SPECIALS,
  jab: { name: "Vampiric Claws", description: "Two claw rakes and a wing strike on repeated jabs." },
  gameplan: DREADLORD_GAMEPLAN,
};
