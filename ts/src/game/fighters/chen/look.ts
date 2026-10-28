import { CHEN_CLIPS, CHEN_DAMAGE_CLIPS, CHEN_FALLBACK_CLIP, CHEN_MODEL_FILE } from "./clips";
import type { HeroLook } from "../../presentation/model/look";

export const chenLook: HeroLook = { model: CHEN_MODEL_FILE, objectId: 0x6d666368,
  portrait: "ReplaceableTextures\\CommandButtons\\BTNPandarenBrewmaster.blp", clips: CHEN_CLIPS, damageClips: CHEN_DAMAGE_CLIPS, fallback: CHEN_FALLBACK_CLIP , defeat: "death"};

export const CHEN_PARASOL_GRIP = { x: 12.0, z: 133.0 } as const;
