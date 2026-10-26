import { KOBOLD_CLIPS, KOBOLD_DAMAGE_CLIPS, KOBOLD_FALLBACK, KOBOLD_MODEL_FILE } from "../../sim/heroes/koboldClips";
import type { HeroLook } from "../model/look";

export const koboldLook: HeroLook = {
  model: KOBOLD_MODEL_FILE,
  objectId: 0x6d666b62,
  portrait: "ReplaceableTextures\\CommandButtons\\BTNKobold.blp",
  clips: KOBOLD_CLIPS, damageClips: KOBOLD_DAMAGE_CLIPS, fallback: KOBOLD_FALLBACK, defeat: "death",
};
