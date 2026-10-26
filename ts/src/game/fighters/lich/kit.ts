

import { Character } from "../../sim/codes";
import type { HeroDefinition } from "../../sim/heroes/hero";
import { LICH_GAMEPLAN } from "./gameplan";
import { LICH_MOVES } from "./moves";
import { LICH_SPECIALS } from "./specials";

export const LICH_HERO: HeroDefinition = {
  character: Character.lich,
  name: "Lich",
  displayName: "Kel'Thuzad",
  purpose: "Deliberate projectile placement",
  weakness: "Frail body and slow attacks at close range",
  complete: true,
  moves: LICH_MOVES,
  specials: LICH_SPECIALS,
  jab: { name: "Chilling Touch", description: "A slap, then a freezing palm on a second jab." },
  gameplan: LICH_GAMEPLAN,
};
