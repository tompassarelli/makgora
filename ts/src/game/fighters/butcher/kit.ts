import { Character } from "../../sim/codes";
import type { HeroDefinition } from "../../sim/heroes/hero";
import { BUTCHER_GAMEPLAN } from "./gameplan";
import { BUTCHER_MOVES } from "./moves";
import { BUTCHER_SPECIALS } from "./specials";

export const BUTCHER_HERO: HeroDefinition = {
  character: Character.butcher, name: "Butcher", displayName: "Stitches",
  purpose: "Heavy ranged grappler: a reel-in hook that turns any spacing into a throw",
  weakness: "The widest body in the roster, combo food, and every missed hook is a long opening",
  complete: true,
  moves: BUTCHER_MOVES, specials: BUTCHER_SPECIALS, gameplan: BUTCHER_GAMEPLAN,
  jab: { name: "Fresh Cuts", description: "A cleaver poke, then a shove of his belly." },
};
