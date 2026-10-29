import { GROM_CLIPS, GROM_DAMAGE_CLIPS, GROM_FALLBACK, GROM_MODEL_FILE } from "./clips";
import type { HeroLook } from "../../presentation/model/look";
import { DEFAULT_COSTUME, DEFAULT_COSTUMES } from "../../presentation/model/costume";

const FEL = { name: "Fel", skin: { textures: { "Units\\Orc\\Hellscream\\Hellscream.blp": "Textures\\HellscreamChaos.blp" } } };

export const gromLook: HeroLook = { model: GROM_MODEL_FILE, objectId: 0x6d666772, portrait: "ReplaceableTextures\\CommandButtons\\BTNHellScream.blp", clips: GROM_CLIPS, damageClips: GROM_DAMAGE_CLIPS, fallback: GROM_FALLBACK , defeat: "death", costumes: [DEFAULT_COSTUME, FEL, ...DEFAULT_COSTUMES.slice(1)] };
