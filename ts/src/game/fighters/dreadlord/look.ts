import { DREADLORD_FALLBACK_CLIP, DREADLORD_MODEL_FILE, dreadlordClipTable } from "./clips";
import { DREADLORD_POUNCE_CLIPS } from "../../presentation/dreadlordPounceClipInfo";
import type { HeroLook, KitNormals } from "../../presentation/model/look";

export const dreadlordLook = (kit: KitNormals): HeroLook => ({
  model: DREADLORD_MODEL_FILE,
  objectId: 0x6d66646c,
  portrait: "ReplaceableTextures\\CommandButtons\\BTNHeroDreadLord.blp",
  clips: dreadlordClipTable(kit),
  fallback: DREADLORD_FALLBACK_CLIP, defeat: "death",
  commandGrab: { travel: DREADLORD_POUNCE_CLIPS.travel, hold: DREADLORD_POUNCE_CLIPS.bite, recovery: DREADLORD_POUNCE_CLIPS.recovery, travelStartsAtMotion: true },
});
