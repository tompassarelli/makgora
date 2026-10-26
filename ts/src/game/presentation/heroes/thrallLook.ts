import { THRALL_MODEL_FILE, THRALL_CLIPS, THRALL_FALLBACK, THRALL_DAMAGE_CLIPS } from "./thrallClips";
import type { HeroLook } from "../model/look";

export const thrallLook: HeroLook = { model: THRALL_MODEL_FILE, objectId: 0x6d667468, portrait: "ReplaceableTextures\\CommandButtons\\BTNThrall.blp", clips: THRALL_CLIPS, damageClips: THRALL_DAMAGE_CLIPS, fallback: THRALL_FALLBACK , defeat: "death"};
