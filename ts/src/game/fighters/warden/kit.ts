

import { Character } from "../../sim/codes";
import type { HeroDefinition } from "../../sim/heroes/hero";
import { WARDEN_GAMEPLAN } from "./gameplan";
import { WARDEN_MOVES } from "./moves";
import { WARDEN_SPECIALS } from "./specials";

export const WARDEN_HERO: HeroDefinition = {
  character: Character.warden,
  name: "Warden",
  displayName: "Maiev Shadowsong",
  purpose: "Precision mobility and edge pressure",
  weakness: "Light body and punishable teleport endpoints",
  complete: true,
  nonWeaponStrikes: { limb: ["down-tilt", "down-smash", "down-air", "down-special"] },
  moves: WARDEN_MOVES,
  specials: WARDEN_SPECIALS,
  jab: { name: "Crescent Flurry", description: "Three quick cuts of her crescent blade on repeated jabs." },
  gameplan: WARDEN_GAMEPLAN,
};
