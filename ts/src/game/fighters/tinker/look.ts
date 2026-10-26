import { TINKER_CLIPS, TINKER_FALLBACK_CLIP } from "./clips";
import { TINKER_DAMAGE_CLIPS } from "./clipInfo";
import type { HeroLook } from "../../presentation/model/look";

export const tinkerLook: HeroLook = {
  model: "units\\creeps\\HeroTinker\\HeroTinker.mdl", objectId: 0x6d667469,
  portrait: "ReplaceableTextures\\CommandButtons\\BTNHeroTinker.blp",
  placedModel: { path: "Units\\Creeps\\HeroTinkerFactory\\HeroTinkerFactory.mdl", height: 100.0, alpha: 255 },
  clips: TINKER_CLIPS, damageClips: TINKER_DAMAGE_CLIPS, fallback: TINKER_FALLBACK_CLIP, defeat: "death",
};
