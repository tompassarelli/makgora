import { Character } from "../../sim/codes";
import type { HeroDefinition } from "../../sim/heroes/hero";
import { CHEN_MOVES } from "./moves";
import { CHEN_SPECIALS } from "./specials";
import { CHEN_GAMEPLAN } from "./gameplan";

export const CHEN_HERO: HeroDefinition = {
  character: Character.chen, name: "Chen Stormstout", displayName: "Chen", purpose: "Drunken footwork and close staff pressure",
  weakness: "Broad body and committed finishes", complete: true,
  moves: CHEN_MOVES, specials: CHEN_SPECIALS, gameplan: CHEN_GAMEPLAN,
  jab: { name: "Staggering Three", description: "A palm, a staff butt and a belly check on repeated jabs." },
};
