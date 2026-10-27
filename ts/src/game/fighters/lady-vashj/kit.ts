import { Character } from "../../sim/codes";
import type { HeroDefinition } from "../../sim/heroes/hero";
import { LADY_VASHJ_MOVES } from "./moves";
import { LADY_VASHJ_SPECIALS } from "./specials";
import { LADY_VASHJ_GAMEPLAN } from "./gameplan";
import { fitMoves, fitSpecials } from "../../sim/weaponRegions";
import { LADY_VASHJ_WEAPON_REGIONS } from "./weaponRegions";

export const LADY_VASHJ_HERO: HeroDefinition = {
  character: Character.ladyVashj, name: "Lady Vashj", purpose: "A serpent queen who lets her foes exhaust themselves against her",
  weakness: "Slow, wide and weak up close once her shield's charge runs dry", complete: true,
  moves: fitMoves(LADY_VASHJ_MOVES, LADY_VASHJ_WEAPON_REGIONS), specials: fitSpecials(LADY_VASHJ_SPECIALS, LADY_VASHJ_WEAPON_REGIONS), gameplan: LADY_VASHJ_GAMEPLAN,
  jab: { name: "Bow Check", description: "A cold rap of the bow limb, then another." },
};
