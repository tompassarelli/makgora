import { Character } from "../../sim/codes";
import type { HeroDefinition } from "../../sim/heroes/hero";
import { STANDIN_GAMEPLAN } from "../standin/gameplan";
import { DRAGON_MOVES, PRESTOR_MOVES } from "./moves";
import { DRAGON_SPECIALS, PRESTOR_SPECIALS } from "./specials";

export const ONYXIA_HERO: HeroDefinition = {
  character: Character.onyxia, name: "Onyxia", displayName: "Onyxia",
  purpose: "Lady Katrana Prestor racks up damage with quick shadow strings; her down special reveals the dragon to finish",
  weakness: "Prestor kills late, and the dragon is a huge, slow target who cannot change back for five seconds",
  complete: true,
  moves: PRESTOR_MOVES, specials: PRESTOR_SPECIALS, gameplan: STANDIN_GAMEPLAN,
  jab: { name: "Backhand and Shadow Palm", description: "A noble's backhand, then a palm of shadow." },
};

export const ONYXIA_DRAGON_HERO: HeroDefinition = {
  character: Character.onyxiaDragon, name: "Onyxia Dragon", displayName: "Onyxia",
  purpose: "The broodmother of the black dragonflight: wide claws, tail and breath that guard the ledge and finish stocks",
  weakness: "A huge, slow body that combos easily, and every stock starts back in human guise",
  complete: false,
  moves: DRAGON_MOVES, specials: DRAGON_SPECIALS, gameplan: STANDIN_GAMEPLAN,
  jab: { name: "Claw and Snap", description: "A raking claw, then a fiery snap of the jaws." },
  homeForm: Character.onyxia,
};
