import { Character } from "../codes";
import type { HeroDefinition } from "./hero";
import { MEDIVH_MOVES } from "./medivhMoves";
import { MEDIVH_SPECIALS } from "./medivhSpecials";
import { MEDIVH_GAMEPLAN } from "./medivhGameplan";

export const MEDIVH_HERO: HeroDefinition = {
  character: Character.medivh, name: "Medivh", purpose: "A mad prophet vanishes before the punchline",
  weakness: "Light body and punishable blink arrivals", complete: true,
  moves: MEDIVH_MOVES, specials: MEDIVH_SPECIALS, gameplan: MEDIVH_GAMEPLAN,
  jab: { name: "Impatient Prophecy", description: "Two pointed staff taps for those who will not listen." },
};
