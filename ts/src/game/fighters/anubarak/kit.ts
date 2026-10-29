import { Character } from "../../sim/codes";
import type { HeroDefinition } from "../../sim/heroes/hero";
import { ANUBARAK_GAMEPLAN } from "./gameplan";
import { ANUBARAK_MOVES } from "./moves";
import { ANUBARAK_SPECIALS } from "./specials";

export const ANUBARAK_HERO: HeroDefinition = {
  character: Character.anubarak, name: "Anub'arak", purpose: "Menacing insect king; heavy ground control",
  weakness: "Broad shell, slow aerials and exposed emergence", complete: true,
  jab: { name: "Royal Rebuke", description: "The king dismisses prey with one tusk, then the other." },
  moves: ANUBARAK_MOVES, specials: ANUBARAK_SPECIALS, gameplan: ANUBARAK_GAMEPLAN,
};
