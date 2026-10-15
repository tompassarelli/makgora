

import { Character } from "../codes";
import type { HeroDefinition } from "./hero";
import { WARDEN_GAMEPLAN } from "./wardenGameplan";
import { WARDEN_MOVES } from "./wardenMoves";
import { WARDEN_SPECIALS } from "./wardenSpecials";

export const WARDEN_HERO: HeroDefinition = {
  character: Character.warden,
  name: "Warden",
  purpose: "Precision mobility and edge pressure",
  weakness: "Light body and punishable teleport endpoints",
  complete: true,
  moves: WARDEN_MOVES,
  specials: WARDEN_SPECIALS,
  jab: { name: "Crescent Flurry", description: "Three quick cuts of her crescent blade on repeated jabs." },
  gameplan: WARDEN_GAMEPLAN,
};
