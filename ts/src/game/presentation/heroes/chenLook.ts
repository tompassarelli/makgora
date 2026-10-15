import { CHEN_CLIPS, CHEN_DAMAGE_CLIPS, CHEN_FALLBACK_CLIP, CHEN_MODEL_FILE } from "../../sim/heroes/chenClips";
import type { HeroLook } from "../model/look";

export const chenLook: HeroLook = { model: CHEN_MODEL_FILE, objectId: 0x6d666368,
  portrait: "ReplaceableTextures\\CommandButtons\\BTNPandarenBrewmaster.blp", clips: CHEN_CLIPS, damageClips: CHEN_DAMAGE_CLIPS, fallback: CHEN_FALLBACK_CLIP };
