import { UTHER_CLIPS, UTHER_DAMAGE_CLIPS, UTHER_FALLBACK, UTHER_MODEL_FILE } from "./clips";
import type { HeroLook } from "../../presentation/model/look";

export const utherLook: HeroLook = { model: UTHER_MODEL_FILE, objectId: 0x6d667568,
  portrait: "ReplaceableTextures\\CommandButtons\\BTNHeroPaladin.blp",
  clips: UTHER_CLIPS, damageClips: UTHER_DAMAGE_CLIPS, fallback: UTHER_FALLBACK, defeat: "death" };
