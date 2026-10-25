import { Character } from "../codes";
import type { HeroDefinition } from "./hero";
import { CAIRNE_GAMEPLAN } from "./cairneGameplan";
import { CAIRNE_MOVES } from "./cairneMoves";
import { CAIRNE_SPECIALS } from "./cairneSpecials";

export const CAIRNE_HERO: HeroDefinition = {
  character: Character.cairne, name: "Cairne Bloodhoof", purpose: "Super-heavyweight with sweeping halberd strikes",
  weakness: "A huge target with slow whiffs and exposed recovery", complete: true,
  jab: { name: "Haft and Halberd", description: "Check with the haft, then press again for the halberd's short finishing blow." },
  moves: CAIRNE_MOVES, specials: CAIRNE_SPECIALS, gameplan: CAIRNE_GAMEPLAN,
};
