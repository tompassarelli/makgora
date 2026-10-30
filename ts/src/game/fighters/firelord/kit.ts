import { Character } from "../../sim/codes";
import type { HeroDefinition } from "../../sim/heroes/hero";
import { standinHero } from "../standin/kit";
import { LAVA_RAZE } from "./specials";

export const FIRELORD_HERO: HeroDefinition = standinHero({
  character: Character.firelord, name: "Firelord", down: LAVA_RAZE,
  effects: { bolt: "Abilities\\Weapons\\FireBallMissile\\FireBallMissile.mdx", burst: "Abilities\\Spells\\Other\\Incinerate\\FireLordDeathExplode.mdx" },
});
