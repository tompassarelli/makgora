import { KAELTHAS_CLIPS, KAELTHAS_DAMAGE_CLIPS, KAELTHAS_FALLBACK, KAELTHAS_MODEL_FILE } from "../../sim/heroes/kaelthasClips";
import type { HeroLook } from "../model/look";

export const kaelthasLook: HeroLook = {
  model: KAELTHAS_MODEL_FILE, objectId: 0x6d666b74,
  portrait: "ReplaceableTextures\\CommandButtons\\BTNHeroBloodElfPrince.blp",
  clips: KAELTHAS_CLIPS, damageClips: KAELTHAS_DAMAGE_CLIPS, fallback: KAELTHAS_FALLBACK,
};
