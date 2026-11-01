import { Character } from "../../sim/codes";
import type { HeroDefinition } from "../../sim/heroes/hero";
import { KAELTHAS_MOVES } from "./moves";
import { KAELTHAS_SPECIALS } from "./specials";
import { KAELTHAS_GAMEPLAN } from "./gameplan";

export const KAELTHAS_HERO: HeroDefinition = {
  character: Character.kaelthas, name: "Kael'thas Sunstrider", displayName: "Kael'thas", purpose: "Curse, drain and burn: a caster who takes your options away", weakness: "Light close normals, a hittable cast arm and the longest recovery charge", complete: true,
  moves: KAELTHAS_MOVES, specials: KAELTHAS_SPECIALS, gameplan: KAELTHAS_GAMEPLAN,
  jab: { name: "Verdant Touch", description: "A palm check, then a sphere shove on a second tap." },
};
