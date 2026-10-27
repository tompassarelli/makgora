import { Character } from "../../sim/codes";
import type { HeroDefinition } from "../../sim/heroes/hero";
import { SYLVANAS_MOVES } from "./moves";
import { SYLVANAS_SPECIALS } from "./specials";
import { SYLVANAS_GAMEPLAN } from "./gameplan";
import { fitMoves, fitSpecials } from "../../sim/weaponRegions";
import { SYLVANAS_WEAPON_REGIONS } from "./weaponRegions";

export const SYLVANAS_HERO: HeroDefinition = {
  character: Character.sylvanas, name: "Sylvanas Windrunner",
  purpose: "Dark arrows and punishable curses", weakness: "Short melee reach and exposed casts",
  complete: true,
  nonWeaponStrikes: { spell: ["side-special", "ultimate"] },
  moves: fitMoves(SYLVANAS_MOVES, SYLVANAS_WEAPON_REGIONS), specials: fitSpecials(SYLVANAS_SPECIALS, SYLVANAS_WEAPON_REGIONS), gameplan: SYLVANAS_GAMEPLAN,
  jab: { name: "Bow Check", description: "Three close checks of the bow on repeated jabs." },
};
