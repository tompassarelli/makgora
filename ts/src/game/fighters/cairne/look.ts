import { CAIRNE_CLIPS, CAIRNE_COMMAND_GRAB, CAIRNE_DAMAGE_CLIPS, CAIRNE_FALLBACK } from "./clips";
import type { HeroLook } from "../../presentation/model/look";

export const cairneLook: HeroLook = {
  model: "units\\orc\\HeroTaurenChieftain\\HeroTaurenChieftain.mdl", objectId: 0x6d666361,
  portrait: "ReplaceableTextures\\CommandButtons\\BTNHeroTaurenChieftain.blp", fallback: CAIRNE_FALLBACK, defeat: "death",
  clips: CAIRNE_CLIPS, damageClips: CAIRNE_DAMAGE_CLIPS, commandGrab: CAIRNE_COMMAND_GRAB,
};
