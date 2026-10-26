import { FORSAKEN_PALADIN_CLIPS, FORSAKEN_PALADIN_FALLBACK_CLIP, FORSAKEN_PALADIN_DAMAGE_CLIPS } from "./clips";
import type { HeroLook } from "../../presentation/model/look";

export const forsakenPaladinLook: HeroLook = {
  model: "Units\\Creeps\\HeroForsakenPaladin\\HeroForsakenPaladin.mdx",
  objectId: 0x6d667574,
  portrait: "ReplaceableTextures\\CommandButtons\\BTNForsakenPaladin.blp",
  clips: FORSAKEN_PALADIN_CLIPS,
  fallback: FORSAKEN_PALADIN_FALLBACK_CLIP, defeat: "death",
  damageClips: FORSAKEN_PALADIN_DAMAGE_CLIPS,
};
