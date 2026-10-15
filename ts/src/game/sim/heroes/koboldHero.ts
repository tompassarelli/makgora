
import { Character } from "../codes";
import type { HeroDefinition } from "./hero";
import { KOBOLD_GAMEPLAN } from "./koboldGameplan";
import { KOBOLD_MOVES } from "./koboldMoves";
import { KOBOLD_SPECIALS } from "./koboldSpecials";

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
