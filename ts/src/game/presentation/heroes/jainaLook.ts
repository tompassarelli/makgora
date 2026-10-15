import { JAINA_CLIPS, JAINA_DAMAGE_CLIPS, JAINA_FALLBACK, JAINA_MODEL_FILE } from "./jainaClips";
import type { HeroLook } from "../model/look";

export const jainaLook: HeroLook = {
  model: JAINA_MODEL_FILE, objectId: 0x6d666a61,
  portrait: "ReplaceableTextures\\CommandButtons\\BTNJaina.blp",
  placedModel: { path: "units\\human\\WaterElemental\\WaterElemental.mdl", height: 110.0, alpha: 255 },
  fallback: JAINA_FALLBACK,
  clips: JAINA_CLIPS,
  damageClips: JAINA_DAMAGE_CLIPS,
};
