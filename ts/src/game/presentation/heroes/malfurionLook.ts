import { MALFURION_CLIPS, MALFURION_DAMAGE_CLIPS, MALFURION_FALLBACK, MALFURION_MODEL_FILE } from "./malfurionClips";
import type { HeroLook } from "../model/look";

export const malfurionLook: HeroLook = {
  model: MALFURION_MODEL_FILE, objectId: 0x6d666d61,
  portrait: "ReplaceableTextures\\CommandButtons\\BTNFurion.blp",
  placedModel: { path: "units\\nightelf\\Ent\\Ent.mdl", height: 110.0, alpha: 255 },
  fallback: MALFURION_FALLBACK,
  clips: MALFURION_CLIPS,
  damageClips: MALFURION_DAMAGE_CLIPS,
};
