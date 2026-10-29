import { Character } from "../../sim/codes";
import type { HeroDefinition } from "../../sim/heroes/hero";
import { TYRANDE_GAMEPLAN } from "./gameplan";
import { TYRANDE_MOVES } from "./moves";
import { TYRANDE_SPECIALS } from "./specials";

export const TYRANDE_HERO: HeroDefinition = {
  character: Character.tyrande, name: "Tyrande", displayName: "Tyrande Whisperwind",
  purpose: "Aerial rushdown archer: quick arrows hold a foe in shield while she closes",
  weakness: "A light body that dies early, and arrows too weak to win from range",
  complete: true,
  moves: TYRANDE_MOVES, specials: TYRANDE_SPECIALS, gameplan: TYRANDE_GAMEPLAN,
  jab: { name: "Bow and Blade", description: "A strike of the bow limb, then a moonlit cut." },
};
