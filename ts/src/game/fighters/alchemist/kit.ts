import { Character } from "../../sim/codes";
import type { HeroDefinition } from "../../sim/heroes/hero";
import { standinHero } from "../standin/kit";

export const ALCHEMIST_HERO: HeroDefinition = standinHero({
  character: Character.alchemist, name: "Goblin Alchemist",
  effects: { bolt: "Abilities\\Spells\\Other\\StrongDrink\\BrewmasterMissile.mdx", burst: "Abilities\\Spells\\Human\\Thunderclap\\ThunderClapCaster.mdx" },
});
