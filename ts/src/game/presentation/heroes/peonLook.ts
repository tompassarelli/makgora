import { PEON_CLIPS, PEON_FALLBACK_CLIP, PEON_PAIN_CLIPS } from "./peonClips";
import type { HeroLook } from "../model/look";

export const peonLook: HeroLook = {
  model: "units\\orc\\Peon\\Peon.mdl",
  objectId: 0x6d667065,
  portrait: "ReplaceableTextures\\CommandButtons\\BTNPeon.blp",
  placedModel: { path: "buildings\\orc\\TrollBurrow\\TrollBurrow.mdl", height: 180.0, alpha: 255 },
  clips: PEON_CLIPS,
  damageClips: PEON_PAIN_CLIPS,
  fallback: PEON_FALLBACK_CLIP,
};
