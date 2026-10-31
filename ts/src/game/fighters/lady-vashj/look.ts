import { LADY_VASHJ_CLIPS, LADY_VASHJ_DAMAGE_CLIPS, LADY_VASHJ_FALLBACK, LADY_VASHJ_MODEL_FILE } from "./clips";
import type { HeroLook } from "../../presentation/model/look";

export const ladyVashjLook: HeroLook = { model: LADY_VASHJ_MODEL_FILE, objectId: 0x6d666c76,
  portrait: "ReplaceableTextures\\CommandButtons\\BTNNagaSeaWitch.blp",
  clips: LADY_VASHJ_CLIPS, damageClips: LADY_VASHJ_DAMAGE_CLIPS, fallback: LADY_VASHJ_FALLBACK, defeat: "death" };
