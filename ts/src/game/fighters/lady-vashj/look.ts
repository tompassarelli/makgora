import { LADY_VASHJ_CLIPS, LADY_VASHJ_DAMAGE_CLIPS, LADY_VASHJ_FALLBACK, LADY_VASHJ_MODEL_FILE } from "./clips";
import { AttackStyle } from "../../sim/codes";
import type { HeroLook } from "../../presentation/model/look";

export const VASHJ_TRAIL_NORMALS: readonly AttackStyle[] = [AttackStyle.jab, AttackStyle.upTilt, AttackStyle.downSmash, AttackStyle.neutralAir, AttackStyle.backAir, AttackStyle.forwardSmash];

export const ladyVashjLook: HeroLook = { model: LADY_VASHJ_MODEL_FILE, objectId: 0x6d666c76,
  portrait: "ReplaceableTextures\\CommandButtons\\BTNNagaSeaWitch.blp",
  clips: LADY_VASHJ_CLIPS, damageClips: LADY_VASHJ_DAMAGE_CLIPS, fallback: LADY_VASHJ_FALLBACK, defeat: "death", cueReadNormals: VASHJ_TRAIL_NORMALS };
