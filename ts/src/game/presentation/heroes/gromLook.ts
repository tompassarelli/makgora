import { GROM_CLIPS, GROM_DAMAGE_CLIPS, GROM_FALLBACK, GROM_MODEL_FILE } from "../../sim/heroes/gromClips";
import type { HeroLook } from "../model/look";

export const gromLook: HeroLook = { model: GROM_MODEL_FILE, objectId: 0x6d666772, portrait: "ReplaceableTextures\\CommandButtons\\BTNHellScream.blp", clips: GROM_CLIPS, damageClips: GROM_DAMAGE_CLIPS, fallback: GROM_FALLBACK };
