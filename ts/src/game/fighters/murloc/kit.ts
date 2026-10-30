
import { Character } from "../../sim/codes";
import type { HeroDefinition } from "../../sim/heroes/hero";
import { MURLOC_GAMEPLAN } from "./gameplan";
import { MURLOC_MOVES } from "./moves";
import { MURLOC_PARTNER_BODY, murlocDamageScale } from "./partner";
import { MURLOC_SPECIALS } from "./specials";

export const MURLOC_HERO: HeroDefinition = {
  character: Character.murloc,
  name: "Murloc",
  displayName: "Murlocs",
  purpose: "Small, light rushdown",
  weakness: "Short reach, early knockouts and a short recovery",
  jab: { name: "Claw Flurry", description: "Two quick stabs, then a flurry of fin slaps while the button is held." },
  complete: true,
  moves: MURLOC_MOVES,
  specials: MURLOC_SPECIALS,
  gameplan: MURLOC_GAMEPLAN,
  partner: MURLOC_PARTNER_BODY,
  damageScale: (role, partnerLive) => murlocDamageScale(role, partnerLive),
};
