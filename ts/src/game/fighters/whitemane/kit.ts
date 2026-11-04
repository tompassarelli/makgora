import { Character } from "../../sim/codes";
import type { HeroDefinition } from "../../sim/heroes/hero";
import { standinHero } from "../standin/kit";

export const WHITEMANE_HERO: HeroDefinition = standinHero({
  character: Character.whitemane, name: "Whitemane", displayName: "Sally Whitemane", comingSoon: true,
  effects: { bolt: "Abilities\\Weapons\\PriestMissile\\PriestMissile.mdl", burst: "Abilities\\Spells\\Human\\Thunderclap\\ThunderClapCaster.mdx" },
});
