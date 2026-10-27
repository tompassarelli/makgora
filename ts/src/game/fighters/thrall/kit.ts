import { Character } from "../../sim/codes";
import type { HeroDefinition } from "../../sim/heroes/hero";
import { THRALL_MOVES } from "./moves";
import { THRALL_SPECIALS } from "./specials";
import { THRALL_GAMEPLAN } from "./gameplan";

export const THRALL_HERO: HeroDefinition = {
  character: Character.thrall, name: "Thrall", purpose: "Heavy hammer brawler with lightning and spirit wolves", weakness: "Slow air drift and an exposed recovery",
  nonWeaponStrikes: { limb: ["back-air", "down-tilt", "forward-tilt-down", "down-smash", "down-air", "dash-attack"], spell: ["neutral-special", "down-special"] },
  complete: true, moves: THRALL_MOVES, specials: THRALL_SPECIALS, gameplan: THRALL_GAMEPLAN,
  jab: { name: "Doomhammer", description: "Check with the handle, then press again for a short hammer hook." },
};
