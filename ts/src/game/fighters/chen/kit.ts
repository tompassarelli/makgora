import { Character } from "../../sim/codes";
import type { HeroDefinition } from "../../sim/heroes/hero";
import { CHEN_MOVES } from "./moves";
import { CHEN_SPECIALS } from "./specials";
import { CHEN_GAMEPLAN } from "./gameplan";
import { fitMoves, fitSpecials } from "../../sim/weaponRegions";
import { CHEN_WEAPON_REGIONS } from "./weaponRegions";

export const CHEN_HERO: HeroDefinition = {
  character: Character.chen, name: "Chen Stormstout", purpose: "Drunken footwork and close staff pressure",
  weakness: "Broad body and committed finishes", complete: true,
  moves: fitMoves(CHEN_MOVES, CHEN_WEAPON_REGIONS), specials: fitSpecials(CHEN_SPECIALS, CHEN_WEAPON_REGIONS), gameplan: CHEN_GAMEPLAN,
  jab: { name: "Staggering Three", description: "A palm, a staff butt and a belly check on repeated jabs." },
};
