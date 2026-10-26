
import { Character } from "../../sim/codes";
import type { HeroDefinition } from "../../sim/heroes/hero";
import { KOBOLD_GAMEPLAN } from "./gameplan";
import { KOBOLD_MOVES } from "./moves";
import { KOBOLD_SPECIALS } from "./specials";

export const KOBOLD_HERO: HeroDefinition = {
  character: Character.kobold,
  name: "Kobold",
  purpose: "Panicky candle-hoarder whose flame grows with every hit",
  weakness: "Strong hits knock his candle out; bare, he only flails",
  jab: { name: "Pick Pick!", description: "Two nervous mining-pick taps. You no take candle!" },
  complete: true,
  moves: KOBOLD_MOVES,
  specials: KOBOLD_SPECIALS,
  gameplan: KOBOLD_GAMEPLAN,
};
