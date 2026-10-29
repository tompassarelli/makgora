import type { HeroDefinition } from "../../sim/heroes/hero";
import { STANDIN_GAMEPLAN } from "./gameplan";
import { standinMoves } from "./moves";
import { type StandinEffects, standinSpecials } from "./specials";

export interface StandinIdentity {
  readonly character: HeroDefinition["character"];
  readonly name: string;
  readonly effects: StandinEffects;
}

export function standinHero({ character, name, effects }: StandinIdentity): HeroDefinition {
  return {
    character, name, displayName: `${name} (WIP)`,
    purpose: "Work-in-progress stand-in: a plain middleweight moveset until his own kit lands",
    weakness: "No signature tools yet: every move is the shared stand-in's",
    complete: true,
    moves: standinMoves(character), specials: standinSpecials(character, effects), gameplan: STANDIN_GAMEPLAN,
    jab: { name: "Stand-in Jab", description: "Two quick strikes ahead." },
  };
}
