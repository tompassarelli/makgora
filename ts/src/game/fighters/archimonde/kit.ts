import { Character } from "../../sim/codes";
import type { HeroDefinition } from "../../sim/heroes/hero";
import { ARCHIMONDE_GAMEPLAN } from "./gameplan";
import { ARCHIMONDE_MOVES } from "./moves";
import { ARCHIMONDE_SPECIALS } from "./specials";

export const ARCHIMONDE_HERO: HeroDefinition = {
  character: Character.archimonde, name: "Archimonde", displayName: "Archimonde",
  purpose: "Superheavy zone-control punisher: marked ground and huge claw strikes",
  weakness: "The largest target and the shortest recovery of the heavies",
  complete: true,
  moves: ARCHIMONDE_MOVES, specials: ARCHIMONDE_SPECIALS, gameplan: ARCHIMONDE_GAMEPLAN,
  jab: { name: "Contempt", description: "A back-handed claw, then a fist for anyone still standing there." },
};
