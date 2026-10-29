import { TYRANDE_CLIPS, TYRANDE_FALLBACK_CLIP, TYRANDE_PAIN_CLIPS } from "./clips";
import type { HeroLook } from "../../presentation/model/look";
import { TYRANDE_ICON, TYRANDE_MODEL } from "../../assets/importedModelInfo";

export const tyrandeLook: HeroLook = {
  model: TYRANDE_MODEL, objectId: 0x6d667479,
  portrait: TYRANDE_ICON,
  clips: TYRANDE_CLIPS, fallback: TYRANDE_FALLBACK_CLIP, defeat: "death", damageClips: TYRANDE_PAIN_CLIPS,
};
