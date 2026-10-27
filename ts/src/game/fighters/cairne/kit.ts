import { Character } from "../../sim/codes";
import type { HeroDefinition } from "../../sim/heroes/hero";
import { CAIRNE_GAMEPLAN } from "./gameplan";
import { CAIRNE_MOVES } from "./moves";
import { CAIRNE_SPECIALS } from "./specials";
import { fitMoves, fitSpecials } from "../../sim/weaponRegions";
import { CAIRNE_WEAPON_REGIONS } from "./weaponRegions";

export const CAIRNE_HERO: HeroDefinition = {
  character: Character.cairne, name: "Cairne Bloodhoof", purpose: "Super-heavyweight with sweeping halberd strikes",
  weakness: "A huge target with slow whiffs and exposed recovery", complete: true,
  jab: { name: "Haft and Halberd", description: "Check with the haft, then press again for the halberd's short finishing blow." },
  moves: fitMoves(CAIRNE_MOVES, CAIRNE_WEAPON_REGIONS), specials: fitSpecials(CAIRNE_SPECIALS, CAIRNE_WEAPON_REGIONS), gameplan: CAIRNE_GAMEPLAN,
};
