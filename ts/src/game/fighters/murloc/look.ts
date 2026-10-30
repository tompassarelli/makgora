import { MURLOC_CLIPS, MURLOC_DAMAGE_CLIPS, MURLOC_FALLBACK, MURLOC_MODEL_FILE } from "./clips";
import { f32 } from "wisp/src/sim/f32";
import type { HeroLook } from "../../presentation/model/look";

export const murlocLook: HeroLook = {
  model: MURLOC_MODEL_FILE,
  objectId: 0x6d666d72,
  portrait: "ReplaceableTextures\\CommandButtons\\BTNMurloc.blp",
  clips: MURLOC_CLIPS, damageClips: MURLOC_DAMAGE_CLIPS, fallback: MURLOC_FALLBACK, defeat: "death",
  partner: { skin: { textures: { "Units\\Creeps\\Murloc\\Murloc.blp": "Units\\Creeps\\MurlocMutant\\MurlocMutant.blp" } }, scale: f32(0.9) },
};
