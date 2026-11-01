import { MURLOC_CLIPS, MURLOC_DAMAGE_CLIPS, MURLOC_FALLBACK, MURLOC_MODEL_FILE } from "./clips";
import { f32 } from "wisp/src/sim/f32";
import { DEFAULT_COSTUMES } from "../../presentation/model/costume";
import type { CostumeSkin } from "../../presentation/model/costume";
import type { HeroLook } from "../../presentation/model/look";

export const MURLOC_STOCK_TEXTURE = "Units\\Creeps\\Murloc\\Murloc.blp";
export const MRGL_TEXTURE = "Units\\Creeps\\MurlocMutant\\MurlocMutant.blp";
export const GRGL_TEXTURE = "Units\\Creeps\\MurlocWarrior\\MurlocWarrior.blp";

const MRGL_SKIN: CostumeSkin = { textures: { [MURLOC_STOCK_TEXTURE]: MRGL_TEXTURE } };
const GRGL_SKIN: CostumeSkin = { textures: { [MURLOC_STOCK_TEXTURE]: GRGL_TEXTURE } };

export const murlocLook: HeroLook = {
  model: MURLOC_MODEL_FILE,
  objectId: 0x6d666d72,
  portrait: "ReplaceableTextures\\CommandButtons\\BTNMurloc.blp",
  clips: MURLOC_CLIPS, damageClips: MURLOC_DAMAGE_CLIPS, fallback: MURLOC_FALLBACK, defeat: "death",
  costumes: [{ name: "Teal", skin: MRGL_SKIN }, ...DEFAULT_COSTUMES.slice(1).map(costume => ({ ...costume, skin: MRGL_SKIN }))],
  partner: { skin: GRGL_SKIN, scale: f32(1.0) },
};
