import { MURLOC_CLIPS, MURLOC_DAMAGE_CLIPS, MURLOC_FALLBACK, MURLOC_MODEL_FILE } from "../../sim/heroes/murlocClips";
import type { HeroLook } from "../model/look";

export const murlocLook: HeroLook = {
  model: MURLOC_MODEL_FILE,
  objectId: 0x6d666d72,
  portrait: "ReplaceableTextures\\CommandButtons\\BTNMurloc.blp",
  clips: MURLOC_CLIPS, damageClips: MURLOC_DAMAGE_CLIPS, fallback: MURLOC_FALLBACK, defeat: "death",
};
