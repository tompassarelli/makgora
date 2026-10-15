import { FORSAKEN_PALADIN_CLIPS, FORSAKEN_PALADIN_FALLBACK_CLIP, FORSAKEN_PALADIN_DAMAGE_CLIPS } from "../../sim/heroes/forsakenPaladinClips";
import type { HeroLook } from "../model/look";

export const forsakenPaladinLook: HeroLook = {
  model: "Units\\Creeps\\HeroForsakenPaladin\\HeroForsakenPaladin.mdx",
  objectId: 0x6d667574,
  portrait: "ReplaceableTextures\\CommandButtons\\BTNForsakenPaladin.blp",
  clips: FORSAKEN_PALADIN_CLIPS,
  fallback: FORSAKEN_PALADIN_FALLBACK_CLIP,
  damageClips: FORSAKEN_PALADIN_DAMAGE_CLIPS,
};
