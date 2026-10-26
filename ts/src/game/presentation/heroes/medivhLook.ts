import { MEDIVH_CLIPS, MEDIVH_DAMAGE_CLIPS, MEDIVH_FALLBACK, MEDIVH_MODEL_FILE } from "./medivhClips";
import { AttackStyle } from "../../sim/codes";
import type { HeroLook } from "../model/look";

export const medivhLook: HeroLook = { model: MEDIVH_MODEL_FILE, objectId: 0x6d666d65,
  portrait: "ReplaceableTextures\\CommandButtons\\BTNMedivh.blp",
  clips: MEDIVH_CLIPS, damageClips: MEDIVH_DAMAGE_CLIPS, fallback: MEDIVH_FALLBACK,
  cueReadNormals: [AttackStyle.dashAttack] };
