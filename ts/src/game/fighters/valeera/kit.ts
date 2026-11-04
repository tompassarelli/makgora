import { Character } from "../../sim/codes";
import type { HeroDefinition } from "../../sim/heroes/hero";
import { standinHero } from "../standin/kit";

export const VALEERA_HERO: HeroDefinition = standinHero({
  character: Character.valeera, name: "Valeera",
  effects: { bolt: "Abilities\\Spells\\NightElf\\ShadowStrike\\ShadowStrikeMissile.mdx", burst: "Abilities\\Spells\\Human\\Thunderclap\\ThunderClapCaster.mdx" },
});
