
import { Character } from "../../sim/codes";
import type { HeroDefinition } from "../../sim/heroes/hero";
import { KOBOLD_GAMEPLAN } from "./gameplan";
import { KOBOLD_MOVES } from "./moves";
import { KOBOLD_SPECIALS } from "./specials";
import { fitMoves, fitSpecials } from "../../sim/weaponRegions";
import { KOBOLD_WEAPON_REGIONS } from "./weaponRegions";

export const KOBOLD_HERO: HeroDefinition = {
  character: Character.kobold,
  name: "Kobold",
  purpose: "Panicky candle-hoarder whose flame grows with every hit",
  weakness: "Strong hits knock his candle out; bare, he only flails",
  jab: { name: "Pick Pick!", description: "Two nervous mining-pick taps. You no take candle!" },
  complete: true,
  moves: fitMoves(KOBOLD_MOVES, KOBOLD_WEAPON_REGIONS),
  specials: fitSpecials(KOBOLD_SPECIALS, KOBOLD_WEAPON_REGIONS),
  gameplan: KOBOLD_GAMEPLAN,
};
