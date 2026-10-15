import { Character } from "../codes";
import type { HeroDefinition } from "./hero";
import { SYLVANAS_MOVES } from "./sylvanasMoves";
import { SYLVANAS_SPECIALS } from "./sylvanasSpecials";
import { SYLVANAS_GAMEPLAN } from "./sylvanasGameplan";

export const SYLVANAS_HERO: HeroDefinition = {
  character: Character.sylvanas, name: "Sylvanas Windrunner",
  purpose: "Dark arrows and punishable curses", weakness: "Short melee reach and exposed casts",
  complete: true,
  moves: SYLVANAS_MOVES, specials: SYLVANAS_SPECIALS, gameplan: SYLVANAS_GAMEPLAN,
  jab: { name: "Bow Check", description: "Three close checks of the bow on repeated jabs." },
};
