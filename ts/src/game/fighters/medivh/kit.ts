import { Character } from "../../sim/codes";
import type { HeroDefinition } from "../../sim/heroes/hero";
import { MEDIVH_MOVES } from "./moves";
import { MEDIVH_SPECIALS } from "./specials";
import { MEDIVH_GAMEPLAN } from "./gameplan";
import { fitMoves, fitSpecials } from "../../sim/weaponRegions";
import { MEDIVH_WEAPON_REGIONS } from "./weaponRegions";

export const MEDIVH_HERO: HeroDefinition = {
  character: Character.medivh, name: "Medivh", purpose: "A mad prophet vanishes before the punchline",
  weakness: "Light body and punishable blink arrivals", complete: true,
  nonWeaponStrikes: { spell: ["side-special", "up-special", "down-special", "ultimate"] },
  moves: fitMoves(MEDIVH_MOVES, MEDIVH_WEAPON_REGIONS), specials: fitSpecials(MEDIVH_SPECIALS, MEDIVH_WEAPON_REGIONS), gameplan: MEDIVH_GAMEPLAN,
  jab: { name: "Impatient Prophecy", description: "Two pointed staff taps for those who will not listen." },
};
