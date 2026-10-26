import { Character } from "../../sim/codes";
import type { HeroDefinition } from "../../sim/heroes/hero";
import { MEDIVH_MOVES } from "./moves";
import { MEDIVH_SPECIALS } from "./specials";
import { MEDIVH_GAMEPLAN } from "./gameplan";

export const MEDIVH_HERO: HeroDefinition = {
  character: Character.medivh, name: "Medivh", purpose: "A mad prophet vanishes before the punchline",
  weakness: "Light body and punishable blink arrivals", complete: true,
  moves: MEDIVH_MOVES, specials: MEDIVH_SPECIALS, gameplan: MEDIVH_GAMEPLAN,
  jab: { name: "Impatient Prophecy", description: "Two pointed staff taps for those who will not listen." },
};
