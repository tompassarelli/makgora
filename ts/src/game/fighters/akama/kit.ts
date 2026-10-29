import { Character } from "../../sim/codes";
import type { HeroDefinition } from "../../sim/heroes/hero";
import { standinHero } from "../standin/kit";
import { SHURIKEN_NEUTRAL } from "./specials";

export const AKAMA_HERO: HeroDefinition = standinHero({
  character: Character.akama, name: "Akama",
  neutral: SHURIKEN_NEUTRAL,
  effects: { bolt: "Abilities\\Spells\\NightElf\\ShadowStrike\\ShadowStrikeMissile.mdx", burst: "Abilities\\Spells\\Human\\Thunderclap\\ThunderClapCaster.mdx" },
});
