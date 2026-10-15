



import { Character } from "../codes";
import type { HeroDefinition } from "./hero";
import { LICH_KING_GAMEPLAN } from "./lichKingGameplan";
import { LICH_KING_MOVES } from "./lichKingMoves";
import { LICH_KING_SPECIALS } from "./lichKingSpecials";

export const LICH_KING_HERO: HeroDefinition = {
  character: Character.lichKing,
  name: "Lich King",
  purpose: "Heavy Frostmourne swordsman who commands the dead",
  weakness: "Slow walk and slow aerials; fast pressure and juggles get inside the blade",
  jab: { name: "Pommel and Rake", description: "A gauntlet check, a rake of the blade, then a Frostmourne thrust on repeated jabs." },
  complete: true,
  moves: LICH_KING_MOVES,
  specials: LICH_KING_SPECIALS,
  gameplan: LICH_KING_GAMEPLAN,
};
