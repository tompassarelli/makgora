import { Character } from "../codes";
import type { HeroDefinition } from "./hero";
import { ANUBARAK_GAMEPLAN } from "./anubarakGameplan";
import { ANUBARAK_MOVES } from "./anubarakMoves";
import { ANUBARAK_SPECIALS } from "./anubarakSpecials";

export const ANUBARAK_HERO: HeroDefinition = {
  character: Character.anubarak, name: "Anub'arak", purpose: "Menacing insect king; heavy ground control",
  weakness: "Broad shell, slow aerials and exposed emergence", complete: true,
  jab: { name: "Royal Rebuke", description: "The king dismisses prey with one tusk, then the other." },
  moves: ANUBARAK_MOVES, specials: ANUBARAK_SPECIALS, gameplan: ANUBARAK_GAMEPLAN,
};
