

import { Character } from "../codes";
import type { HeroDefinition } from "./hero";
import { DREADLORD_GAMEPLAN } from "./dreadlordGameplan";
import { DREADLORD_MOVES } from "./dreadlordMoves";
import { DREADLORD_SPECIALS } from "./dreadlordSpecials";

export const DREADLORD_HERO: HeroDefinition = {
  character: Character.dreadlord,
  name: "Dreadlord",
  purpose: "Air movement, grabs, and close pressure",
  weakness: "Large hurtbox and no safe long-range approach",
  complete: true,
  moves: DREADLORD_MOVES,
  specials: DREADLORD_SPECIALS,
  jab: { name: "Vampiric Claws", description: "Two claw rakes and a wing strike on repeated jabs." },
  gameplan: DREADLORD_GAMEPLAN,
};
