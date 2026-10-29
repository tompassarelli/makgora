import { Character } from "../../sim/codes";
import type { HeroDefinition } from "../../sim/heroes/hero";
import { standinHero } from "../standin/kit";

export const FIRELORD_HERO: HeroDefinition = standinHero({
  character: Character.firelord, name: "Firelord",
  effects: { bolt: "Abilities\\Weapons\\FireBallMissile\\FireBallMissile.mdx", burst: "Abilities\\Spells\\Other\\Incinerate\\FireLordDeathExplode.mdx" },
});
