import { ANUBARAK_CLIPS, ANUBARAK_DAMAGE_CLIPS, ANUBARAK_FALLBACK, ANUBARAK_MODEL_FILE } from "./clips";
import { AttackStyle } from "../../sim/codes";
import type { HeroLook } from "../../presentation/model/look";

export const anubarakLook: HeroLook = { model: ANUBARAK_MODEL_FILE, objectId: 0x6d660000 | 0x616e,
  portrait: "ReplaceableTextures\\CommandButtons\\BTNHeroCryptLord.blp",
  placedModel: { path: "Units\\Undead\\Scarab\\Scarab.mdl", height: 35.0, alpha: 255 },
  clips: ANUBARAK_CLIPS, damageClips: ANUBARAK_DAMAGE_CLIPS, fallback: ANUBARAK_FALLBACK, defeat: "death",
  cueReadNormals: [AttackStyle.dashAttack] };
