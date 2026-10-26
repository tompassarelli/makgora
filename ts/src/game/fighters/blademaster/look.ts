import { BLADEMASTER_CLIPS, BLADEMASTER_FALLBACK_CLIP } from "./clips";
import type { HeroLook } from "../../presentation/model/look";

export const blademasterLook: HeroLook = {
  model: "units\\orc\\HeroBladeMaster\\HeroBladeMaster.mdl",
  objectId: 0x6d66626d,
  portrait: "ReplaceableTextures\\CommandButtons\\BTNHeroBlademaster.blp",

  placedModel: { path: "units\\orc\\HeroBladeMaster\\HeroBladeMaster.mdl", height: 140.0, alpha: 120 },
  clips: BLADEMASTER_CLIPS,
  fallback: BLADEMASTER_FALLBACK_CLIP, defeat: "death",
};
