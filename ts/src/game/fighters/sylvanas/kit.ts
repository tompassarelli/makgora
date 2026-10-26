import { Character } from "../../sim/codes";
import type { HeroDefinition } from "../../sim/heroes/hero";
import { SYLVANAS_MOVES } from "./moves";
import { SYLVANAS_SPECIALS } from "./specials";
import { SYLVANAS_GAMEPLAN } from "./gameplan";

export const SYLVANAS_HERO: HeroDefinition = {
  character: Character.sylvanas, name: "Sylvanas Windrunner",
  purpose: "Dark arrows and punishable curses", weakness: "Short melee reach and exposed casts",
  complete: true,
  moves: SYLVANAS_MOVES, specials: SYLVANAS_SPECIALS, gameplan: SYLVANAS_GAMEPLAN,
  jab: { name: "Bow Check", description: "Three close checks of the bow on repeated jabs." },
};
